import initSqlJs from 'sql.js';
import type { Database, QueryExecResult } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, setLogLevel, terminate } from 'firebase/firestore';

setLogLevel('silent'); // Suppress verbose internal gRPC retry logs when quota limit is reached

const require = createRequire(import.meta.url);

let dbInstance: Database | null = null;
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');
const SEED_FILE = path.resolve(process.cwd(), 'data', 'database.sqlite');
const QUOTA_FILE = path.join(DATA_DIR, 'firestore_quota_exhausted.json');

export function checkPersistedQuotaExhaustion(): boolean {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
      const exhaustedAt = new Date(data.timestamp).getTime();
      const now = Date.now();
      // If quota was exhausted less than 24 hours ago, pause Firestore writes today
      if (now - exhaustedAt < 24 * 60 * 60 * 1000) {
        return true;
      } else {
        try {
          fs.unlinkSync(QUOTA_FILE);
        } catch (e) {}
      }
    }
  } catch (e) {}
  return false;
}

export function persistQuotaExhaustion() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      QUOTA_FILE,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        reason: 'Free daily write units per project exceeded (Spark plan)',
      })
    );
  } catch (e) {}
}

let isFirestoreQuotaExhausted = checkPersistedQuotaExhaustion();

// Cloud Firestore configuration for permanent multi-device persistence
let firestoreDb: any = null;
if (!isFirestoreQuotaExhausted) {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (config.projectId) {
        const fbApp = getApps().length > 0 ? getApp() : initializeApp(config);
        firestoreDb = getFirestore(fbApp, config.firestoreDatabaseId);
        console.log('[Firebase Cloud] Cloud Firestore terhubung untuk persistensi lintas perangkat.');
      }
    }
  } catch (e) {
    console.warn('[Firebase Cloud] Gagal menginisialisasi Firestore backend:', e);
  }
} else {
  console.log('[Firebase Cloud] Kuota gratis harian Firestore tercapai hari ini. Menggunakan basis data lokal persisten.');
}

export function markQuotaExhausted() {
  if (isFirestoreQuotaExhausted && !firestoreDb) return;
  isFirestoreQuotaExhausted = true;
  persistQuotaExhaustion();
  console.warn(
    '[Firebase Cloud] Kuota gratis harian Firestore tercapai. Menutup koneksi gRPC dan beralih penuh ke basis data lokal.'
  );
  if (firestoreDb) {
    try {
      terminate(firestoreDb).catch(() => {});
    } catch (e) {}
    firestoreDb = null;
  }
}

export const DEFAULT_WHATSAPP_TEMPLATE = `*INFO PAPANDAYAN - FAKTUR INVOICE RESMI*

Yth. Bapak/Ibu *{nama_pelanggan}*,
Terima kasih atas kepercayaannya menggunakan layanan Info Papandayan. Berikut ringkasan faktur tagihan Anda:

📄 *No. Invoice:* {nomor_invoice}
📅 *Tanggal Kegiatan:* {tanggal}
🏷️ *Total Tagihan:* *{total}*
💳 *Status:* *{status}*

📋 *Rincian Layanan/Barang:*
{rincian_barang}

🏦 *Metode Pembayaran Resmi:*
{metode_pembayaran}

📥 *Unduh Langsung File PDF Resmi (Klik untuk Download):*
{link_pdf}

{catatan}

Faktur invoice resmi dalam format PDF siap diunduh secara instan tanpa perlu akun/login. Silakan hubungi kami apabila memerlukan penyesuaian.

Salam hangat,
*{nama_perusahaan}*
WhatsApp: {telepon_perusahaan}
Website: {website_perusahaan}`;

export const DEFAULT_PAYMENT_METHODS = [
  {
    id: 'mandiri-1',
    name: 'Bank Mandiri',
    category: 'bank',
    account_no: '131-00-1849201-8',
    account_name: 'Info Papandayan',
    notes: 'KCP Garut',
    is_active: true,
  },
  {
    id: 'bca-1',
    name: 'Bank BCA',
    category: 'bank',
    account_no: '148-098-7654',
    account_name: 'Info Papandayan',
    notes: 'KCU Garut',
    is_active: true,
  },
  {
    id: 'bri-1',
    name: 'Bank BRI',
    category: 'bank',
    account_no: '0102-01-098765-50-1',
    account_name: 'Info Papandayan',
    notes: 'Cabang Cisurupan',
    is_active: false,
  },
  {
    id: 'qris-1',
    name: 'QRIS Resmi Info Papandayan',
    category: 'qris',
    account_no: 'NMID: ID1020030040500',
    account_name: 'Info Papandayan',
    notes: 'Dapat di-scan melalui BCA Mobile, Livin, GoPay, OVO, Dana, ShopeePay',
    is_active: false,
  },
  {
    id: 'cash-1',
    name: 'Pembayaran Tunai / Cash',
    category: 'cash',
    account_no: 'Kasir Kantor',
    account_name: 'Info Papandayan',
    notes: 'Pembayaran langsung di kantor operasional Cisurupan Garut',
    is_active: false,
  },
];

function getWasmBinary(): Buffer | undefined {
  const attempts = [
    () => {
      const p = require.resolve('sql.js/dist/sql-wasm.wasm');
      return fs.existsSync(p) ? fs.readFileSync(p) : undefined;
    },
    () => {
      const p = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
      return fs.existsSync(p) ? fs.readFileSync(p) : undefined;
    },
    () => {
      const p = path.resolve(process.cwd(), 'sql-wasm.wasm');
      return fs.existsSync(p) ? fs.readFileSync(p) : undefined;
    },
  ];

  for (const fn of attempts) {
    try {
      const buf = fn();
      if (buf) return buf;
    } catch {
      // ignore
    }
  }
  return undefined;
}

let isSavingToFirestore = false;
let pendingSave = false;
let lastCheckTime = 0;
let currentDbVersion = 0;
let sqlJsEngine: any = null;

let syncDebounceTimer: any = null;

export function isCloudPersistenceActive(): boolean {
  return !!firestoreDb && !isFirestoreQuotaExhausted;
}

export function getCurrentDbVersion(): number {
  return currentDbVersion;
}

export async function checkAndSyncFromFirestore(force = false): Promise<void> {
  if (!firestoreDb || isFirestoreQuotaExhausted) return;
  const now = Date.now();
  if (!force && now - lastCheckTime < 1500) return; // Check at most once every 1.5s
  lastCheckTime = now;

  try {
    const metaSnap = await getDoc(doc(firestoreDb, 'system', 'database_meta'));
    if (!metaSnap.exists()) return;
    const meta = metaSnap.data();
    const cloudVersion = meta?.version || 0;

    // Compare directly against in-memory currentDbVersion to ensure multi-device sync
    if (cloudVersion > currentDbVersion) {
      console.log(`[Firebase Cloud] Snapshot cloud lebih baru terdeteksi (v${cloudVersion} > v${currentDbVersion}). Mengunduh ke memori...`);
      const cloudBuffer = await loadFromFirestore();
      if (cloudBuffer && sqlJsEngine) {
        try {
          const testDb = new sqlJsEngine.Database(cloudBuffer);
          const check = testDb.exec('PRAGMA integrity_check;');
          if (check[0]?.values[0]?.[0] === 'ok') {
            dbInstance = testDb;
            currentDbVersion = cloudVersion;
            try {
              fs.writeFileSync(DB_FILE, cloudBuffer);
            } catch (e) {}
            console.log(`[Firebase Cloud] Basis data server berhasil diperbarui ke snapshot Cloud v${cloudVersion}.`);
          } else {
            console.warn('[Firebase Cloud] Snapshot cloud tidak lolos integrity check, mengabaikan.');
          }
        } catch (e) {
          console.warn('[Firebase Cloud] Gagal menerapkan cloud snapshot:', e);
        }
      }
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
    }
  }
}

export async function syncToFirestore(): Promise<void> {
  if (!dbInstance || !firestoreDb || isFirestoreQuotaExhausted) return;
  if (isSavingToFirestore) {
    pendingSave = true;
    return;
  }
  isSavingToFirestore = true;
  try {
    const check = dbInstance.exec('PRAGMA integrity_check;');
    if (check[0]?.values[0]?.[0] !== 'ok') {
      console.warn('[Firebase Cloud] Memory database corrupted, skipping cloud upload');
      return;
    }

    const data = dbInstance.export();
    const base64 = Buffer.from(data).toString('base64');
    const CHUNK_SIZE = 750 * 1024; // 750KB safe chunk size (below 1MB Firestore doc limit)
    const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);
    const newVersion = Date.now();

    // 1. Write all chunks FIRST
    for (let i = 0; i < totalChunks; i++) {
      const chunk = base64.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await setDoc(doc(firestoreDb, 'system', `database_chunk_${i}`), {
        chunk_index: i,
        data: chunk,
        updated_at: new Date().toISOString(),
      });
    }

    // 2. Only write metadata AFTER all chunks succeed
    await setDoc(doc(firestoreDb, 'system', 'database_meta'), {
      total_chunks: totalChunks,
      total_bytes: data.byteLength,
      updated_at: new Date().toISOString(),
      version: newVersion,
    });

    currentDbVersion = newVersion;
    console.log(
      `[Firebase Cloud] Basis data berhasil dicadangkan ke Cloud Firestore (v${newVersion}, ${(data.byteLength / 1024).toFixed(1)} KB)`
    );
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('Quota limit') ||
      msg.includes('Quota exceeded') ||
      err?.code === 'resource-exhausted' ||
      err?.code === 8
    ) {
      markQuotaExhausted();
    } else {
      console.warn('[Firebase Cloud] Note: ' + msg);
    }
  } finally {
    isSavingToFirestore = false;
    if (pendingSave && !isFirestoreQuotaExhausted) {
      pendingSave = false;
      syncToFirestore().catch(() => {});
    } else {
      pendingSave = false;
    }
  }
}

export async function loadFromFirestore(): Promise<Buffer | null> {
  if (!firestoreDb || isFirestoreQuotaExhausted) return null;
  try {
    const metaSnap = await getDoc(doc(firestoreDb, 'system', 'database_meta'));
    if (!metaSnap.exists()) return null;
    const meta = metaSnap.data();
    const totalChunks = meta?.total_chunks || 1;
    let fullBase64 = '';
    for (let i = 0; i < totalChunks; i++) {
      const chunkSnap = await getDoc(doc(firestoreDb, 'system', `database_chunk_${i}`));
      if (!chunkSnap.exists()) return null;
      fullBase64 += chunkSnap.data()?.data || '';
    }
    if (fullBase64.length > 0) {
      const buffer = Buffer.from(fullBase64, 'base64');
      if (sqlJsEngine) {
        try {
          const testDb = new sqlJsEngine.Database(buffer);
          const check = testDb.exec('PRAGMA integrity_check;');
          if (check[0]?.values[0]?.[0] === 'ok') {
            currentDbVersion = meta?.version || Date.now();
            return buffer;
          } else {
            console.warn('[Firebase Cloud] Snapshot cloud tidak lolos integrity check, mengabaikan snapshot.');
            return null;
          }
        } catch (e) {
          return null;
        }
      }
      return buffer;
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota limit') || err?.code === 'resource-exhausted') {
      isFirestoreQuotaExhausted = true;
    }
  }
  return null;
}

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    try {
      const check = dbInstance.exec('PRAGMA integrity_check;');
      if (check[0]?.values[0]?.[0] === 'ok') return dbInstance;
    } catch (e) {}
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[Database] Could not create DATA_DIR, will use in-memory SQLite:', err);
  }

  const wasmBuffer = getWasmBinary();
  const wasmBinary: ArrayBuffer | undefined = wasmBuffer
    ? (wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength) as ArrayBuffer)
    : undefined;

  const SQL = await initSqlJs({
    locateFile: (file) => {
      try {
        return require.resolve(`sql.js/dist/${file}`);
      } catch {
        return path.resolve(process.cwd(), 'node_modules/sql.js/dist', file);
      }
    },
    ...(wasmBinary ? { wasmBinary } : {}),
  });
  sqlJsEngine = SQL;

  // If on Vercel and seed file exists, copy seed file to writable /tmp
  if (isVercel && fs.existsSync(SEED_FILE) && !fs.existsSync(DB_FILE)) {
    try {
      fs.copyFileSync(SEED_FILE, DB_FILE);
    } catch (e) {
      console.warn('[Database] Could not copy seed DB to /tmp, will load directly or init fresh');
    }
  }

  // 1. FIRST PRIORITY: Always check Cloud Firestore if active!
  // Because Cloud Firestore contains the authoritative multi-device snapshot
  let loadedFromCloud = false;
  if (firestoreDb && !isFirestoreQuotaExhausted) {
    try {
      console.log('[Firebase Cloud] Memeriksa snapshot basis data di Cloud Firestore...');
      const cloudBuffer = await loadFromFirestore();
      if (cloudBuffer) {
        const testDb = new SQL.Database(cloudBuffer);
        const check = testDb.exec('PRAGMA integrity_check;');
        if (check[0]?.values[0]?.[0] === 'ok') {
          dbInstance = testDb;
          loadedFromCloud = true;
          try {
            fs.writeFileSync(DB_FILE, cloudBuffer);
          } catch (e) {}
          console.log(`[Firebase Cloud] Berhasil memuat basis data dari Cloud Firestore (v${currentDbVersion})`);
        }
      }
    } catch (err) {
      console.warn('[Firebase Cloud] Gagal memuat dari Cloud Firestore pada inisialisasi:', err);
    }
  }

  // 2. SECOND PRIORITY: If Cloud was empty/unavailable, load local disk DB
  if (!dbInstance) {
    const targetFile = fs.existsSync(DB_FILE) ? DB_FILE : fs.existsSync(SEED_FILE) ? SEED_FILE : null;
    if (targetFile) {
      try {
        const fileBuffer = fs.readFileSync(targetFile);
        const testDb = new SQL.Database(fileBuffer);
        const check = testDb.exec('PRAGMA integrity_check;');
        if (check[0]?.values[0]?.[0] === 'ok') {
          dbInstance = testDb;
          currentDbVersion = Date.now();
          console.log('[Database] Menggunakan basis data lokal terverifikasi sehat:', targetFile);
        }
      } catch (err) {
        console.warn('[Database] File lokal tidak lolos tes integritas:', err);
      }
    }
  }

  // 3. THIRD PRIORITY: Fallback to fresh DB
  if (!dbInstance) {
    dbInstance = new SQL.Database();
    currentDbVersion = Date.now();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');
  initSchemaAndSeed(dbInstance);

  // If we initialized from local seed or fresh, seed Cloud Firestore immediately so all devices share it
  if (!loadedFromCloud && firestoreDb && !isFirestoreQuotaExhausted) {
    try {
      console.log('[Firebase Cloud] Mengunggah basis data awal ke Cloud Firestore...');
      saveDb(false);
      await syncToFirestore();
    } catch (e) {}
  }

  return dbInstance;
}

export function saveDb(syncNow = false) {
  if (!dbInstance) return;
  try {
    // Integrity check before saving to disk
    const check = dbInstance.exec('PRAGMA integrity_check;');
    if (check[0]?.values[0]?.[0] !== 'ok') {
      console.warn('[Database CRITICAL] In-memory database corrupt, skipping save to avoid disk corruption');
      return;
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.warn('[Database] Warning: Could not write to disk, changes preserved in memory:', err);
  }

  if (syncNow) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncToFirestore().catch(() => {});
  } else {
    // Fast debounce: 500ms for swift cloud replication
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      syncToFirestore().catch(() => {});
    }, 500);
  }
}

export async function saveAndSyncDb(): Promise<void> {
  saveDb(false);
  await syncToFirestore();
}

// Helper to execute select queries and return array of objects
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper to execute single row query
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper to execute insert/update/delete with auto-recovery from corrupted state
export function runQuery(sql: string, params: any[] = []): { lastInsertRowId: number; changes: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  try {
    dbInstance.run(sql, params);
  } catch (err: any) {
    if (err?.message?.includes('malformed') || err?.message?.includes('corrupt')) {
      console.error('[Database CRITICAL] Deteksi database malformed saat runQuery, memulihkan dari file disk...');
      const targetFile = fs.existsSync(DB_FILE) ? DB_FILE : fs.existsSync(SEED_FILE) ? SEED_FILE : null;
      if (targetFile && sqlJsEngine) {
        const fileBuffer = fs.readFileSync(targetFile);
        const recoveredDb = new sqlJsEngine.Database(fileBuffer);
        const check = recoveredDb.exec('PRAGMA integrity_check;');
        if (check[0]?.values[0]?.[0] === 'ok') {
          dbInstance = recoveredDb;
          recoveredDb.run(sql, params);
          console.log('[Database] Query berhasil dijalankan ulang setelah pemulihan database!');
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (!dbInstance) throw new Error('Database instance missing after execution');
  const lastIdResult = dbInstance.exec('SELECT last_insert_rowid() as id;');
  const lastInsertRowId = (lastIdResult[0]?.values[0]?.[0] as number) || 0;
  const changesResult = dbInstance.exec('SELECT changes() as cnt;');
  const changes = (changesResult[0]?.values[0]?.[0] as number) || 0;
  saveDb();
  return { lastInsertRowId, changes };
}

function initSchemaAndSeed(db: Database) {
  // 1. Roles table
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );
  `);

  // 2. Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles (id)
    );
  `);

  // 3. Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Products table
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      unit TEXT NOT NULL DEFAULT 'Pcs',
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );
  `);

  // 5. Customers table
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Invoices table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_address TEXT,
      customer_phone TEXT,
      activity_date TEXT NOT NULL,
      due_date TEXT,
      bank_account_no TEXT,
      bank_name TEXT,
      bank_account_name TEXT,
      notes TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed',
      discount_rate REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_percent REAL DEFAULT 11,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'paid',
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id),
      FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    );
  `);

  // 7. Invoice items table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'Pcs',
      price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );
  `);

  // 8. Company settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY,
      company_name TEXT NOT NULL,
      logo_url TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      bank_account_no TEXT,
      bank_name TEXT,
      bank_account_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. Invoice settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_settings (
      id INTEGER PRIMARY KEY,
      prefix TEXT DEFAULT 'INV',
      number_format TEXT DEFAULT 'INV/{YYYY}/{MM}/{NUMBER}',
      start_number INTEGER DEFAULT 1,
      date_format TEXT DEFAULT 'DD/MM/YYYY',
      currency TEXT DEFAULT 'IDR',
      default_tax_percent REAL DEFAULT 11,
      default_discount REAL DEFAULT 0,
      default_notes TEXT,
      signature_text TEXT DEFAULT 'Hormat Kami,',
      signer_name TEXT DEFAULT 'Mohamad Rizal',
      signer_title TEXT DEFAULT 'Direktur Operasional Info Papandayan',
      footer_text TEXT,
      primary_color TEXT DEFAULT '#136239',
      secondary_color TEXT DEFAULT '#7ba892',
      app_name TEXT DEFAULT 'Info Papandayan - Invoice & Logistik',
      header_image_url TEXT DEFAULT '/invoice-header.svg',
      footer_image_url TEXT DEFAULT '/invoice-footer.svg',
      whatsapp_template TEXT,
      payment_methods TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.run(`ALTER TABLE invoice_settings ADD COLUMN header_image_url TEXT DEFAULT '/invoice-header.svg';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE invoice_settings ADD COLUMN footer_image_url TEXT DEFAULT '/invoice-footer.svg';`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE invoice_settings ADD COLUMN whatsapp_template TEXT;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE invoice_settings ADD COLUMN payment_methods TEXT;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE invoice_settings ADD COLUMN public_app_url TEXT;`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE invoices ADD COLUMN payment_methods TEXT;`);
  } catch (e) {}

  // Update existing template to include {link_pdf} if not already present
  try {
    const currentTplRow = db.exec(`SELECT whatsapp_template FROM invoice_settings WHERE id = 1;`);
    const currentTpl = currentTplRow[0]?.values[0]?.[0] as string | undefined;
    if (currentTpl && !currentTpl.includes('{link_pdf}')) {
      const updatedTpl = currentTpl.replace(
        /\{link_download\}/g,
        `{link_download}\n\n📥 *Unduh Langsung File PDF Resmi:*\n{link_pdf}`
      );
      const stmt = db.prepare(`UPDATE invoice_settings SET whatsapp_template = ? WHERE id = 1;`);
      stmt.run([updatedTpl]);
      stmt.free();
    }
  } catch (e) {}

  // 10. Activity logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default roles if empty
  const roleCheck = db.exec('SELECT COUNT(*) as cnt FROM roles;');
  const roleCount = (roleCheck[0]?.values[0]?.[0] as number) || 0;
  if (roleCount === 0) {
    db.run(`
      INSERT INTO roles (id, name, description) VALUES
      (1, 'super_admin', 'Super Admin - Memiliki akses penuh ke seluruh sistem dan konfigurasi'),
      (2, 'admin', 'Admin - Mengelola operasional invoice, produk, pelanggan, dan laporan');
    `);
  }

  // Seed default users if empty
  const userCheck = db.exec('SELECT COUNT(*) as cnt FROM users;');
  const userCount = (userCheck[0]?.values[0]?.[0] as number) || 0;
  if (userCount === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const staffHash = bcrypt.hashSync('staff123', 10);
    db.run(`
      INSERT INTO users (id, username, email, password_hash, role_id, full_name, is_active) VALUES
      (1, 'admin', 'admin@invoicemanager.id', '${adminHash}', 1, 'Administrator Utama', 1),
      (2, 'staff', 'staff@invoicemanager.id', '${staffHash}', 2, 'Staff Logistik & Invoice', 1);
    `);
  }

  // Seed default company settings if empty
  const compCheck = db.exec('SELECT COUNT(*) as cnt FROM company_settings;');
  const compCount = (compCheck[0]?.values[0]?.[0] as number) || 0;
  if (compCount === 0) {
    db.run(`
      INSERT INTO company_settings (
        id, company_name, logo_url, address, phone, email, website,
        bank_account_no, bank_name, bank_account_name
      ) VALUES (
        1,
        'Info Papandayan',
        '/invoice-header.svg',
        'Jl. Kawah Papandayan, Karamat Wangi, Kec. Cisurupan, Kab. Garut',
        '+62 822-4063-0123 / +62 813-2127-3552',
        'info@infopapandayan.com',
        'https://infopapandayan.com',
        '131-00-1849201-8',
        'Bank Mandiri KCP Garut',
        'Info Papandayan'
      );
    `);
  }

  // Seed default invoice settings if empty
  const invSetCheck = db.exec('SELECT COUNT(*) as cnt FROM invoice_settings;');
  const invSetCount = (invSetCheck[0]?.values[0]?.[0] as number) || 0;
  if (invSetCount === 0) {
    db.run(`
      INSERT INTO invoice_settings (
        id, prefix, number_format, start_number, date_format, currency,
        default_tax_percent, default_discount, default_notes,
        signature_text, signer_name, signer_title, footer_text,
        primary_color, secondary_color, app_name,
        whatsapp_template, payment_methods
      ) VALUES (
        1,
        'INV',
        'INV/{YYYY}/{MM}/{NUMBER}',
        1,
        'DD/MM/YYYY',
        'IDR',
        11.0,
        0,
        '1. Pembayaran jatuh tempo 14 hari sejak tanggal invoice diterbitkan.\n2. Pembayaran ditransfer ke rekening resmi atas nama Info Papandayan.\n3. Harap menyertakan nomor invoice pada kolom berita transfer.',
        'Hormat Kami,',
        'Mohamad Rizal',
        'Direktur Operasional Info Papandayan',
        'Invoice ini diterbitkan secara sah melalui Sistem Invoice & Manajemen Barang Info Papandayan.',
        '#136239',
        '#7ba892',
        'Sistem Invoice & Logistik - Info Papandayan',
        ?,
        ?
      );
    `, [DEFAULT_WHATSAPP_TEMPLATE, JSON.stringify(DEFAULT_PAYMENT_METHODS)]);
  } else {
    // Ensure whatsapp_template and payment_methods have fallback if empty, without overwriting custom settings
    try {
      const existingSettings = db.exec('SELECT whatsapp_template, payment_methods FROM invoice_settings WHERE id = 1;');
      const currentWa = existingSettings[0]?.values[0]?.[0];
      const currentPay = existingSettings[0]?.values[0]?.[1];
      if (!currentWa) {
        db.run('UPDATE invoice_settings SET whatsapp_template = ? WHERE id = 1;', [DEFAULT_WHATSAPP_TEMPLATE]);
      }
      if (!currentPay) {
        db.run('UPDATE invoice_settings SET payment_methods = ? WHERE id = 1;', [JSON.stringify(DEFAULT_PAYMENT_METHODS)]);
      }
    } catch (e) {
      // ignore
    }
  }

  // Seed categories if empty
  const catCheck = db.exec('SELECT COUNT(*) as cnt FROM categories;');
  const catCount = (catCheck[0]?.values[0]?.[0] as number) || 0;
  if (catCount === 0) {
    db.run(`
      INSERT INTO categories (id, name, description) VALUES
      (1, 'Elektronik & IT', 'Perangkat keras komputer, server, dan aksesoris teknologi'),
      (2, 'Perangkat Jaringan', 'Router, switch, access point, dan kabel LAN'),
      (3, 'ATK & Kantor', 'Peralatan tulis, kertas, dan perlengkapan administrasi'),
      (4, 'Furnitur Kantor', 'Meja, kursi ergonomis, dan lemari arsip'),
      (5, 'Konsumabel & Tinta', 'Toner printer, cartridge, dan consumable printing');
    `);
  }

  // Seed products if empty
  const prodCheck = db.exec('SELECT COUNT(*) as cnt FROM products;');
  const prodCount = (prodCheck[0]?.values[0]?.[0] as number) || 0;
  if (prodCount === 0) {
    db.run(`
      INSERT INTO products (id, code, name, category_id, unit, price, stock, status, description) VALUES
      (1, 'PRD-001', 'Laptop Asus ExpertBook B1400 14" i5 16GB/512GB', 1, 'Unit', 12500000, 18, 'active', 'Laptop bisnis tangguh spesifikasi Intel Core i5 gen 11'),
      (2, 'PRD-002', 'Monitor Dell Professional 24" P2422H IPS FHD', 1, 'Unit', 2750000, 32, 'active', 'Monitor kantor bezel tipis height adjustable'),
      (3, 'PRD-003', 'Wireless Router Mikrotik RB4011iGS+RM Gigabit', 2, 'Unit', 3600000, 14, 'active', 'Routerboard rackmount 10x Gigabit & 1x SFP+ 10Gbps'),
      (4, 'PRD-004', 'Managed Switch Cisco Catalyst CBS250 24-Port GE PoE', 2, 'Unit', 8900000, 8, 'active', 'Switch manageable PoE+ 24 Port Gigabit'),
      (5, 'PRD-005', 'Kabel UTP Cat6 Belden Original 305 Meter', 2, 'Roll', 2450000, 25, 'active', 'Kabel LAN indoor original 1000ft'),
      (6, 'PRD-006', 'Kertas HVS PaperOne A4 80gr 1 Dus (5 Rim)', 3, 'Box', 285000, 85, 'active', 'Kertas cetak premium ultra white 80 gsm'),
      (7, 'PRD-007', 'Kursi Kerja Ergonomis Indachi Lumbar Support', 4, 'Unit', 1650000, 20, 'active', 'Kursi kantor hidrolik sandaran jaring breathable'),
      (8, 'PRD-008', 'Toner HP LaserJet Original 85A (CE285A) Black', 5, 'Pcs', 980000, 40, 'active', 'Cartridge toner original HP untuk printer LaserJet Pro P1102'),
      (9, 'PRD-009', 'UPS APC Smart-UPS 1500VA LCD 230V SMT1500I', 1, 'Unit', 8400000, 9, 'active', 'Cadangan daya murni sinus untuk rack/server penting'),
      (10, 'PRD-010', 'Printer Laser Brother Multifungsi DCP-L2540DW', 1, 'Unit', 3200000, 15, 'active', 'Printer laser hitam putih print scan copy wifi network');
    `);
  }

  // Seed customers if empty
  const custCheck = db.exec('SELECT COUNT(*) as cnt FROM customers;');
  const custCount = (custCheck[0]?.values[0]?.[0] as number) || 0;
  if (custCount === 0) {
    db.run(`
      INSERT INTO customers (id, name, address, phone, email, notes) VALUES
      (1, 'PT Megah Karya Nusantara', 'Wisma BNI 46 Lt. 18, Jl. Jend. Sudirman Kav. 1, Jakarta Pusat', '021-5748899', 'procurement@megahkarya.co.id', 'Klien korporat langganan kontrak IT maintenance bulanan'),
      (2, 'CV Mitra Mandiri Solusindo', 'Ruko Sentra Niaga Blok B No. 12, Jl. Pemuda, Surabaya', '031-8499211', 'finance@mitramandiri.com', 'Distributor partner regional Jawa Timur'),
      (3, 'Dinas Komunikasi & Informatika', 'Jl. Merdeka Barat No. 8, Bandung, Jawa Barat', '022-4239871', 'diskominfo.pengadaan@prov.go.id', 'Instansi pemerintah daerah - PO pengadaan perangkat keras'),
      (4, 'PT Indo Finansial Solusi', 'Pacific Place Office Tower Lt. 9, SCBD, Jakarta Selatan', '021-25556789', 'admin.keuangan@indofin.id', 'Fintech startup - pembayaran tempo 30 hari'),
      (5, 'Yayasan Pendidikan Harapan Bangsa', 'Jl. Raya Pajajaran No. 45, Bogor', '0251-8321098', 'yayasan@harapanbangsa.ac.id', 'Pengadaan laboratorium komputer dan sarana kelas');
    `);
  }

  // Seed sample invoices and items if empty
  const invCheck = db.exec('SELECT COUNT(*) as cnt FROM invoices;');
  const invCount = (invCheck[0]?.values[0]?.[0] as number) || 0;
  if (invCount === 0) {
    const curYear = new Date().getFullYear();
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    // Invoice 1
    db.run(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, customer_name, customer_address, customer_phone,
        activity_date, due_date, bank_account_no, bank_name, bank_account_name,
        notes, subtotal, discount_type, discount_rate, discount_amount,
        tax_percent, tax_amount, total_amount, status, created_by_user_id, created_at
      ) VALUES (
        1,
        'INV/${curYear}/${curMonth}/0001',
        1,
        'PT Megah Karya Nusantara',
        'Wisma BNI 46 Lt. 18, Jl. Jend. Sudirman Kav. 1, Jakarta Pusat',
        '021-5748899',
        '${curYear}-${curMonth}-02',
        '${curYear}-${curMonth}-16',
        '131-00-1849201-8',
        'Bank Mandiri KCP Garut',
        'Info Papandayan',
        'Pengadaan perangkat IT dan jaringan untuk lantai 18.',
        37500000,
        'percent',
        5,
        1875000,
        11,
        3918750,
        39543750,
        'paid',
        1,
        '${curYear}-${curMonth}-02 10:15:00'
      );
    `);

    db.run(`
      INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, unit, price, subtotal) VALUES
      (1, 1, 'PRD-001', 'Laptop Asus ExpertBook B1400 14" i5 16GB/512GB', 2, 'Unit', 12500000, 25000000),
      (1, 4, 'PRD-004', 'Managed Switch Cisco Catalyst CBS250 24-Port GE PoE', 1, 'Unit', 8900000, 8900000),
      (1, 3, 'PRD-003', 'Wireless Router Mikrotik RB4011iGS+RM Gigabit', 1, 'Unit', 3600000, 3600000);
    `);

    // Invoice 2
    db.run(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, customer_name, customer_address, customer_phone,
        activity_date, due_date, bank_account_no, bank_name, bank_account_name,
        notes, subtotal, discount_type, discount_rate, discount_amount,
        tax_percent, tax_amount, total_amount, status, created_by_user_id, created_at
      ) VALUES (
        2,
        'INV/${curYear}/${curMonth}/0002',
        4,
        'PT Indo Finansial Solusi',
        'Pacific Place Office Tower Lt. 9, SCBD, Jakarta Selatan',
        '021-25556789',
        '${curYear}-${curMonth}-03',
        '${curYear}-${curMonth}-17',
        '131-00-1849201-8',
        'Bank Mandiri KCP Garut',
        'Info Papandayan',
        'Perlengkapan monitor display workstation tim engineer.',
        13750000,
        'fixed',
        0,
        0,
        11,
        1512500,
        15262500,
        'paid',
        1,
        '${curYear}-${curMonth}-03 14:30:00'
      );
    `);

    db.run(`
      INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, unit, price, subtotal) VALUES
      (2, 2, 'PRD-002', 'Monitor Dell Professional 24" P2422H IPS FHD', 5, 'Unit', 2750000, 13750000);
    `);

    // Invoice 3
    db.run(`
      INSERT INTO invoices (
        id, invoice_number, customer_id, customer_name, customer_address, customer_phone,
        activity_date, due_date, bank_account_no, bank_name, bank_account_name,
        notes, subtotal, discount_type, discount_rate, discount_amount,
        tax_percent, tax_amount, total_amount, status, created_by_user_id, created_at
      ) VALUES (
        3,
        'INV/${curYear}/${curMonth}/0003',
        2,
        'CV Mitra Mandiri Solusindo',
        'Ruko Sentra Niaga Blok B No. 12, Jl. Pemuda, Surabaya',
        '031-8499211',
        '${curYear}-${curMonth}-04',
        '${curYear}-${curMonth}-20',
        '131-00-1849201-8',
        'Bank Mandiri KCP Garut',
        'Info Papandayan',
        'Order roll kabel UTP dan consumable toner printer.',
        11720000,
        'fixed',
        0,
        220000,
        11,
        1265000,
        12765000,
        'pending',
        2,
        '${curYear}-${curMonth}-04 09:20:00'
      );
    `);

    db.run(`
      INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, unit, price, subtotal) VALUES
      (3, 5, 'PRD-005', 'Kabel UTP Cat6 Belden Original 305 Meter', 4, 'Roll', 2450000, 9800000),
      (3, 8, 'PRD-008', 'Toner HP LaserJet Original 85A (CE285A) Black', 2, 'Pcs', 980000, 1960000);
    `);

    // Seed activity logs
    db.run(`
      INSERT INTO activity_logs (user_id, username, action, details, ip_address, created_at) VALUES
      (1, 'admin', 'Login', 'Admin masuk ke sistem', '127.0.0.1', '${curYear}-${curMonth}-01 08:30:00'),
      (1, 'admin', 'Buat Invoice', 'Membuat Invoice No INV/${curYear}/${curMonth}/0001 (PT Megah Karya Nusantara)', '127.0.0.1', '${curYear}-${curMonth}-02 10:15:00'),
      (1, 'admin', 'Buat Invoice', 'Membuat Invoice No INV/${curYear}/${curMonth}/0002 (PT Indo Finansial Solusi)', '127.0.0.1', '${curYear}-${curMonth}-03 14:30:00'),
      (2, 'staff', 'Buat Invoice', 'Membuat Invoice No INV/${curYear}/${curMonth}/0003 (CV Mitra Mandiri Solusindo)', '127.0.0.1', '${curYear}-${curMonth}-04 09:20:00');
    `);
  }
}
