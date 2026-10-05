import express from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import multer from 'multer';
import {
  queryAll,
  queryOne,
  runQuery,
  saveDb,
  DEFAULT_WHATSAPP_TEMPLATE,
  DEFAULT_PAYMENT_METHODS,
  isCloudPersistenceActive,
  syncToFirestore,
  checkAndSyncFromFirestore,
} from './db.ts';
import { requireAuth, requireSuperAdmin, logActivity, AuthenticatedRequest, generateToken } from './auth.ts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah, formatDateIndo, terbilang } from '../src/lib/utils.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const apiRouter = express.Router();

// ==========================================
// CLOUD PERSISTENCE & SYNC ROUTES
// ==========================================

apiRouter.get('/system/cloud-status', (_req: Request, res: Response) => {
  const active = isCloudPersistenceActive();
  return res.json({
    success: true,
    cloud_active: active,
    provider: 'Google Cloud Firestore',
    message: active
      ? 'Basis data aktif terhubung ke Cloud Firestore. Data tersimpan aman dan tidak akan hilang di browser atau perangkat lain.'
      : 'Mode basis data lokal aktif.',
  });
});

apiRouter.post('/system/sync-cloud', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await syncToFirestore();
    return res.json({
      success: true,
      message: 'Basis data berhasil disinkronkan ke Cloud Firestore!',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Gagal menyinkronkan data: ' + (err?.message || String(err)),
    });
  }
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username/Email dan Password wajib diisi' });
  }

  const user = queryOne<any>(
    `SELECT u.*, r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE (LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?))`,
    [username.trim(), username.trim()]
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'Kombinasi username atau password salah' });
  }

  if (user.is_active !== 1) {
    return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan. Silakan hubungi Super Admin' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Kombinasi username atau password salah' });
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role_id: user.role_id,
    role_name: user.role_name,
    is_active: user.is_active,
  });

  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
  logActivity(user.id, user.username, 'Login', `Pengguna ${user.full_name} (${user.role_name}) berhasil masuk`, ip);

  return res.json({
    success: true,
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id,
      role_name: user.role_name,
    },
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ip = req.ip || '127.0.0.1';
  if (req.user) {
    logActivity(req.user.id, req.user.username, 'Logout', `Pengguna ${req.user.full_name} keluar dari sistem`, ip);
  }
  return res.json({ success: true, message: 'Logout berhasil' });
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Password saat ini dan password baru wajib diisi' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
    }

    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Konfirmasi password baru tidak cocok' });
    }

    const userId = req.user?.id;
    const user = queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    const isMatch = bcrypt.compareSync(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Password saat ini salah' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    runQuery(`UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`, [newHash, userId]);
    saveDb();

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    logActivity(user.id, user.username, 'Ganti Password', `Pengguna ${user.full_name} (@${user.username}) berhasil memperbarui password`, ip);

    return res.json({
      success: true,
      message: 'Password berhasil diubah. Silakan gunakan password baru untuk sesi berikutnya.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengubah password: ' + err.message });
  }
});

// ==========================================
// 2. DASHBOARD STATS ROUTE
// ==========================================

apiRouter.get('/dashboard/stats', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const curYear = new Date().getFullYear();
    const curMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${curYear}-${curMonth}`;

    // Total invoice
    const invCountRow = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM invoices WHERE status != 'cancelled'`);
    const totalInvoices = invCountRow?.count || 0;

    // Invoices this month
    const invMonthRow = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM invoices WHERE status != 'cancelled' AND activity_date LIKE ?`,
      [`${monthPrefix}%`]
    );
    const invoicesThisMonth = invMonthRow?.count || 0;

    // Total barang keluar
    const itemsOutRow = queryOne<{ total_qty: number }>(
      `SELECT COALESCE(SUM(ii.qty), 0) as total_qty
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.status != 'cancelled'`
    );
    const totalBarangKeluar = itemsOutRow?.total_qty || 0;

    // Barang keluar bulan ini
    const itemsOutMonthRow = queryOne<{ total_qty: number }>(
      `SELECT COALESCE(SUM(ii.qty), 0) as total_qty
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.status != 'cancelled' AND i.activity_date LIKE ?`,
      [`${monthPrefix}%`]
    );
    const barangKeluarThisMonth = itemsOutMonthRow?.total_qty || 0;

    // Total produk terdaftar
    const prodCountRow = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products WHERE status = 'active'`);
    const totalProduk = prodCountRow?.count || 0;

    // Total nilai invoice
    const totalAmountRow = queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status != 'cancelled'`
    );
    const totalNilaiInvoice = totalAmountRow?.total || 0;

    // Nilai invoice bulan ini
    const totalAmountMonthRow = queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status != 'cancelled' AND activity_date LIKE ?`,
      [`${monthPrefix}%`]
    );
    const nilaiInvoiceThisMonth = totalAmountMonthRow?.total || 0;

    // Invoice terbaru (5 data)
    const recentInvoices = queryAll(
      `SELECT id, invoice_number, customer_name, activity_date, total_amount, status, created_at
       FROM invoices
       ORDER BY id DESC
       LIMIT 6`
    );

    // Barang yang paling sering keluar
    const topProducts = queryAll(
      `SELECT ii.product_code, ii.product_name, ii.unit,
              SUM(ii.qty) as total_qty,
              SUM(ii.subtotal) as total_value
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.status != 'cancelled'
       GROUP BY ii.product_name, ii.product_code, ii.unit
       ORDER BY total_qty DESC
       LIMIT 5`
    );

    // Monthly chart data (last 6 months)
    const monthlyStats: Array<{ month: string; label: string; revenue: number; itemsOut: number; count: number }> = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const ym = `${y}-${m}`;
      const label = `${monthNames[d.getMonth()]} ${y}`;

      const revRow = queryOne<{ rev: number; count: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) as rev, COUNT(*) as count
         FROM invoices
         WHERE status != 'cancelled' AND activity_date LIKE ?`,
        [`${ym}%`]
      );

      const itemRow = queryOne<{ qty: number }>(
        `SELECT COALESCE(SUM(ii.qty), 0) as qty
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE i.status != 'cancelled' AND i.activity_date LIKE ?`,
        [`${ym}%`]
      );

      monthlyStats.push({
        month: ym,
        label,
        revenue: revRow?.rev || 0,
        itemsOut: itemRow?.qty || 0,
        count: revRow?.count || 0,
      });
    }

    return res.json({
      success: true,
      data: {
        totalInvoices,
        invoicesThisMonth,
        totalBarangKeluar,
        barangKeluarThisMonth,
        totalProduk,
        totalNilaiInvoice,
        nilaiInvoiceThisMonth,
        recentInvoices,
        topProducts,
        monthlyStats,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard: ' + err.message });
  }
});

// ==========================================
// 3. PRODUCTS MANAGEMENT ROUTES
// ==========================================

apiRouter.get('/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, category_id, status, sort_by = 'id', sort_dir = 'DESC', page = '1', limit = '10', all } = req.query;

    const isAll = all === 'true' || all === '1' || limit === 'all' || limit === '0' || limit === 'all_catalog';
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = isAll ? 50000 : Math.min(10000, Math.max(1, parseInt(limit as string, 10) || 10));
    const offset = isAll ? 0 : (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      whereClauses.push('(p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)');
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (category_id && category_id !== 'all' && category_id !== '0' && category_id !== '') {
      const parsedCatId = parseInt(category_id as string, 10);
      if (!isNaN(parsedCatId) && parsedCatId > 0) {
        whereClauses.push('p.category_id = ?');
        params.push(parsedCatId);
      }
    }

    if (status && status !== 'all' && status !== '') {
      whereClauses.push('p.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Validate sort
    const validSortCols: Record<string, string> = {
      id: 'p.id',
      code: 'p.code',
      name: 'p.name',
      price: 'p.price',
      stock: 'p.stock',
      status: 'p.status',
      category: 'c.name',
    };
    const sortCol = validSortCols[sort_by as string] || 'p.id';
    const sortDirection = (sort_dir as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereSql}
    `;
    const countRow = queryOne<{ total: number }>(countQuery, params);
    const total = countRow?.total || 0;

    // Data
    const dataQuery = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereSql}
      ORDER BY ${sortCol} ${sortDirection}
      ${isAll ? '' : 'LIMIT ? OFFSET ?'}
    `;
    const queryParams = isAll ? params : [...params, limitNum, offset];
    const products = queryAll(dataQuery, queryParams);

    return res.json({
      success: true,
      data: products,
      pagination: {
        page: isAll ? 1 : pageNum,
        limit: isAll ? total : limitNum,
        total,
        totalPages: isAll ? 1 : Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat produk: ' + err.message });
  }
});

// Get all products without pagination for bulk export and selection
apiRouter.get('/products/all', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const products = queryAll(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name ASC, p.id DESC
    `);
    return res.json({ success: true, data: products, total: products.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat katalog produk lengkap: ' + err.message });
  }
});

// Helper to sanitize price and stock inputs from form / Indonesian formats
function sanitizePrice(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val || '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.max(0, num);
}

function sanitizeStock(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.floor(val);
  const str = String(val || '').replace(/[^0-9-]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : Math.max(0, num);
}

// Create product
apiRouter.post('/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    let { code, name, category_id, unit, price, stock, status = 'active', description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama produk wajib diisi' });
    }

    const numPrice = sanitizePrice(price);
    const numStock = sanitizeStock(stock);

    // Auto-generate unique code if blank
    let finalCode = (code && typeof code === 'string') ? code.trim().toUpperCase() : '';
    if (!finalCode) {
      const maxIdRow = queryOne<{ maxId: number }>('SELECT MAX(id) as maxId FROM products');
      const nextId = (maxIdRow?.maxId || 0) + 1;
      finalCode = `PRD-${String(nextId).padStart(3, '0')}`;
    }

    // Check duplicate code
    const existing = queryOne('SELECT id FROM products WHERE LOWER(code) = LOWER(?)', [finalCode]);
    if (existing) {
      if (!code || !code.trim()) {
        let counter = 1;
        while (queryOne('SELECT id FROM products WHERE LOWER(code) = LOWER(?)', [`${finalCode}-${counter}`])) {
          counter++;
        }
        finalCode = `${finalCode}-${counter}`;
      } else {
        return res.status(400).json({ success: false, message: `Kode produk '${finalCode}' sudah digunakan oleh produk lain` });
      }
    }

    // Validate category_id exists in categories to prevent SQLite foreign key error
    let catId: number | null = null;
    if (category_id) {
      const parsedCatId = parseInt(category_id, 10);
      if (!isNaN(parsedCatId) && parsedCatId > 0) {
        const catRow = queryOne('SELECT id FROM categories WHERE id = ?', [parsedCatId]);
        if (catRow) {
          catId = catRow.id;
        }
      }
    }

    const finalStatus = (status && status.trim()) ? status.trim() : 'active';

    const result = runQuery(
      `INSERT INTO products (code, name, category_id, unit, price, stock, status, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [finalCode, name.trim(), catId, unit?.trim() || 'Pcs', numPrice, numStock, finalStatus, description?.trim() || '']
    );

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Tambah Produk',
      `Menambah produk baru ${finalCode} - ${name.trim()}`,
      req.ip
    );

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan',
      productId: result.lastInsertRowId,
      code: finalCode,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan produk: ' + err.message });
  }
});

// Update product
apiRouter.put('/products/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    let { code, name, category_id, unit, price, stock, status, description } = req.body;

    const existing = queryOne<any>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama produk wajib diisi' });
    }

    let finalCode = (code && typeof code === 'string') ? code.trim().toUpperCase() : existing.code;

    const numPrice = sanitizePrice(price);
    const numStock = sanitizeStock(stock);

    // Check duplicate code on other products
    const duplicate = queryOne('SELECT id FROM products WHERE LOWER(code) = LOWER(?) AND id != ?', [finalCode, id]);
    if (duplicate) {
      return res.status(400).json({ success: false, message: `Kode produk '${finalCode}' sudah digunakan oleh produk lain` });
    }

    // Validate category_id exists in categories to prevent SQLite foreign key error
    let catId: number | null = null;
    if (category_id) {
      const parsedCatId = parseInt(category_id, 10);
      if (!isNaN(parsedCatId) && parsedCatId > 0) {
        const catRow = queryOne('SELECT id FROM categories WHERE id = ?', [parsedCatId]);
        if (catRow) {
          catId = catRow.id;
        }
      }
    }

    const finalStatus = (status && status.trim()) ? status.trim() : existing.status;

    runQuery(
      `UPDATE products
       SET code = ?, name = ?, category_id = ?, unit = ?, price = ?, stock = ?, status = ?, description = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [finalCode, name.trim(), catId, unit?.trim() || 'Pcs', numPrice, numStock, finalStatus, description?.trim() || '', id]
    );

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Edit Produk',
      `Mengubah data produk ID ${id} (${finalCode})`,
      req.ip
    );

    return res.json({ success: true, message: 'Produk berhasil diperbarui' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui produk: ' + err.message });
  }
});

// Delete product (Admin can delete products; historical invoices preserve product code/name/price)
apiRouter.delete('/products/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = queryOne<any>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }

    // Unlink product_id in invoice_items to prevent foreign key issues while keeping invoice history intact
    runQuery('UPDATE invoice_items SET product_id = NULL WHERE product_id = ?', [id]);

    // Permanently remove product from catalog
    runQuery('DELETE FROM products WHERE id = ?', [id]);
    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Produk',
      `Menghapus produk ${existing.code} - ${existing.name} dari sistem`,
      req.ip
    );

    return res.json({
      success: true,
      message: `Produk '${existing.code} - ${existing.name}' berhasil dihapus dari sistem`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus produk: ' + err.message });
  }
});

// Bulk delete products
apiRouter.post('/products/bulk-delete', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar ID produk tidak valid' });
    }

    let deletedCount = 0;
    for (const id of ids) {
      runQuery('UPDATE invoice_items SET product_id = NULL WHERE product_id = ?', [id]);
      const result = runQuery('DELETE FROM products WHERE id = ?', [id]);
      if (result.changes > 0) deletedCount++;
    }
    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Masal Produk',
      `Menghapus ${deletedCount} produk dari katalog`,
      req.ip
    );

    return res.json({
      success: true,
      message: `${deletedCount} produk berhasil dihapus dari sistem`,
      deletedCount,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus produk masal: ' + err.message });
  }
});

// Export products to Excel
apiRouter.get('/products/export', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const products = queryAll(`
      SELECT p.code, p.name, c.name as category_name, p.unit, p.price, p.stock, p.status, p.description
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id ASC
    `);

    const exportData = products.map((p, idx) => ({
      No: idx + 1,
      'Kode Produk': p.code,
      'Nama Produk': p.name,
      Kategori: p.category_name || '-',
      Satuan: p.unit,
      'Harga (Rp)': p.price,
      'Stok Saat Ini': p.stock,
      Status: p.status === 'active' ? 'Aktif' : 'Nonaktif',
      Keterangan: p.description || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Produk');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Daftar-Produk-${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengekspor data produk: ' + err.message });
  }
});

// Download template Excel for products import (no strict auth required so browser download always succeeds)
apiRouter.get('/products/template', (_req: Request, res: Response) => {
  try {
    const templateData = [
      {
        'Kode Produk': 'PRD-101',
        'Nama Produk': 'Tiket Masuk Wisata Kawah Papandayan',
        'Kategori': 'Tiket & Wisata',
        'Satuan': 'Orang',
        'Harga': 35000,
        'Stok': 500,
        'Keterangan': 'Tiket reguler pengunjung domestik hari kerja / akhir pekan',
      },
      {
        'Kode Produk': 'PRD-102',
        'Nama Produk': 'Paket Camping Camp Papandayan 2D1N',
        'Kategori': 'Paket Wisata & Camp',
        'Satuan': 'Paket',
        'Harga': 275000,
        'Stok': 50,
        'Keterangan': 'Paket kemah lengkap tenda kapasitas 4, matras, dan tiket area camp',
      },
      {
        'Kode Produk': 'PRD-103',
        'Nama Produk': 'Jasa Pemandu / Tour Guide Trekking',
        'Kategori': 'Layanan Pemandu',
        'Satuan': 'Orang',
        'Harga': 175000,
        'Stok': 25,
        'Keterangan': 'Pemandu resmi rute kawah belerang, hutan mati & tegal alun',
      },
      {
        'Kode Produk': 'PRD-104',
        'Nama Produk': 'Kaos Signature Info Papandayan Garut',
        'Kategori': 'Souvenir & Apparel',
        'Satuan': 'Pcs',
        'Harga': 85000,
        'Stok': 120,
        'Keterangan': 'Kaos katun premium sablon plastisol Info Papandayan',
      },
      {
        'Kode Produk': 'PRD-105',
        'Nama Produk': 'Sewa Tenda Dome Kapasitas 4 Orang',
        'Kategori': 'Peralatan Outdoor',
        'Satuan': 'Unit',
        'Harga': 80000,
        'Stok': 40,
        'Keterangan': 'Tenda waterproof double layer include frame dan pasak',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 38 },
      { wch: 22 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 55 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Produk');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Template-Import-Produk-InfoPapandayan.xlsx"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengunduh template Excel: ' + err.message });
  }
});

// Helper to parse numeric values from Indonesian and English Excel formats
function parseExcelNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;
  // Strip Currency symbols like Rp, Rp., IDR, $, spaces
  str = str.replace(/^(Rp\.?|IDR|\$)\s*/i, '').replace(/[^\d.,-]/g, '').trim();
  if (!str) return 0;
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.') && !str.includes(',')) {
    if (/\.\d{3}$/.test(str)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',') && !str.includes('.')) {
    if (/,\d{3}$/.test(str)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function getExcelRowField(row: Record<string, any>, possibleNames: string[]): string {
  const rowKeys = Object.keys(row);
  for (const cand of possibleNames) {
    const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of rowKeys) {
      const keyClean = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keyClean === candClean) {
        return String(row[key] ?? '').trim();
      }
    }
  }
  return '';
}

// Import Excel Preview
apiRouter.post('/products/import-preview', requireAuth, upload.single('file') as any, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File Excel (.xlsx / .xls) wajib diunggah' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, message: 'File Excel tidak memiliki lembar kerja (sheet)' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'File Excel kosong atau tidak memiliki baris data' });
    }

    // Existing products codes
    const existingProducts = queryAll<{ code: string }>('SELECT code FROM products');
    const existingCodes = new Set(existingProducts.map((p) => p.code.toLowerCase()));

    // Existing categories
    const categories = queryAll<{ id: number; name: string }>('SELECT id, name FROM categories');
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

    const previewRows: any[] = [];
    let validCount = 0;
    let errorCount = 0;
    const seenCodesInFile = new Set<string>();

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for header line
      // Try resolving variations of header names
      let code = getExcelRowField(row, ['Kode Produk', 'Kode Barang', 'Kode', 'Code', 'SKU', 'Item Code', 'ID Produk']);
      const name = getExcelRowField(row, ['Nama Produk', 'Nama Barang', 'Nama', 'Name', 'Item Name', 'Deskripsi Barang', 'Produk', 'Barang']);
      const category = getExcelRowField(row, ['Kategori', 'Category', 'Jenis', 'Kelompok', 'Golongan']) || 'Umum';
      const unit = getExcelRowField(row, ['Satuan', 'Unit', 'UOM', 'Kemasan']) || 'Pcs';
      const rawPrice = getExcelRowField(row, ['Harga', 'Harga Jual', 'Harga Satuan', 'Price', 'Tarif', 'Nilai', 'Harga Produk']);
      const rawStock = getExcelRowField(row, ['Stok', 'Stock', 'Qty', 'Jumlah', 'Kuantitas', 'Saldo']);
      const description = getExcelRowField(row, ['Keterangan', 'Deskripsi', 'Description', 'Catatan', 'Notes']);

      const price = parseExcelNumeric(rawPrice);
      const stock = Math.max(0, Math.floor(parseExcelNumeric(rawStock)));

      const errors: string[] = [];

      // If code is not provided, generate a fallback unique code
      if (!code) {
        code = `PRD-${String(Date.now()).slice(-4)}-${index + 1}`;
      } else {
        const lowerCode = code.toLowerCase();
        if (seenCodesInFile.has(lowerCode)) {
          errors.push(`Kode produk '${code}' duplikat di dalam file Excel`);
        } else {
          seenCodesInFile.add(lowerCode);
        }
      }

      if (!name) {
        errors.push('Nama produk / barang tidak boleh kosong');
      }

      if (price < 0) {
        errors.push('Harga tidak boleh negatif');
      }

      const isUpdate = code ? existingCodes.has(code.toLowerCase()) : false;
      const isValid = errors.length === 0;

      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      previewRows.push({
        rowNumber,
        code: code.toUpperCase(),
        name,
        category,
        categoryId: categoryMap.get(category.toLowerCase()) || null,
        unit,
        price,
        stock,
        description,
        isUpdate,
        isValid,
        error: errors.join('; '),
      });
    });

    return res.json({
      success: true,
      totalRows: rawRows.length,
      validCount,
      errorCount,
      rows: previewRows,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memproses file Excel: ' + err.message });
  }
});

// Import Excel Commit
apiRouter.post('/products/import-commit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data produk yang valid untuk disimpan' });
    }

    // Categories map
    const categories = queryAll<{ id: number; name: string }>('SELECT id, name FROM categories');
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

    let inserted = 0;
    let updated = 0;

    for (const item of rows) {
      if (!item.isValid || !item.code || !item.name) continue;

      let categoryId = item.categoryId;
      if (!categoryId && item.category) {
        const catNameTrim = item.category.trim();
        if (categoryMap.has(catNameTrim.toLowerCase())) {
          categoryId = categoryMap.get(catNameTrim.toLowerCase());
        } else {
          // Auto create new category
          const newCat = runQuery('INSERT INTO categories (name, description) VALUES (?, ?)', [
            catNameTrim,
            'Dibuat otomatis saat import Excel',
          ]);
          categoryId = newCat.lastInsertRowId;
          categoryMap.set(catNameTrim.toLowerCase(), categoryId);
        }
      }

      const existing = queryOne('SELECT id FROM products WHERE LOWER(code) = LOWER(?)', [item.code.trim()]);
      if (existing) {
        runQuery(
          `UPDATE products
           SET name = ?, category_id = ?, unit = ?, price = ?, stock = ?, description = ?, status = 'active', updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [item.name.trim(), categoryId || null, item.unit || 'Pcs', item.price || 0, item.stock || 0, item.description || '', existing.id]
        );
        updated++;
      } else {
        runQuery(
          `INSERT INTO products (code, name, category_id, unit, price, stock, status, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
          [item.code.trim().toUpperCase(), item.name.trim(), categoryId || null, item.unit || 'Pcs', item.price || 0, item.stock || 0, item.description || '']
        );
        inserted++;
      }
    }

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Import Excel Produk',
      `Import selesai: ${inserted} produk baru ditambahkan, ${updated} produk diperbarui`,
      req.ip
    );

    return res.json({
      success: true,
      message: `Import berhasil disimpan: ${inserted} produk baru, ${updated} produk diperbarui`,
      inserted,
      updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan import produk: ' + err.message });
  }
});

// ==========================================
// 4. CATEGORIES ROUTES
// ==========================================

apiRouter.get('/categories', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = queryAll(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return res.json({ success: true, data: categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat kategori: ' + err.message });
  }
});

apiRouter.post('/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const existing = queryOne('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [name.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: `Kategori '${name}' sudah ada` });
    }

    const result = runQuery('INSERT INTO categories (name, description) VALUES (?, ?)', [name.trim(), description?.trim() || '']);

    logActivity(req.user?.id || null, req.user?.username || 'admin', 'Tambah Kategori', `Membuat kategori: ${name.trim()}`, req.ip);

    return res.status(201).json({
      success: true,
      message: 'Kategori berhasil ditambahkan',
      categoryId: result.lastInsertRowId,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal membuat kategori: ' + err.message });
  }
});

// ==========================================
// 5. CUSTOMERS MANAGEMENT ROUTES
// ==========================================

apiRouter.get('/customers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '10', all } = req.query;

    if (all === 'true') {
      const customers = queryAll('SELECT * FROM customers ORDER BY name ASC');
      return res.json({ success: true, data: customers });
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    let params: any[] = [];

    if (search) {
      whereClause = 'WHERE (c.name LIKE ? OR c.address LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      const s = `%${(search as string).trim()}%`;
      params.push(s, s, s, s);
    }

    const countRow = queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, params);
    const total = countRow?.total || 0;

    const dataQuery = `
      SELECT c.*, COUNT(i.id) as invoice_count, COALESCE(SUM(i.total_amount), 0) as total_spent
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'cancelled'
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `;

    const customers = queryAll(dataQuery, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pelanggan: ' + err.message });
  }
});

apiRouter.post('/customers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, address, phone, email, notes } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan/perusahaan wajib diisi' });
    }

    const result = runQuery(
      `INSERT INTO customers (name, address, phone, email, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [name.trim(), address?.trim() || '', phone?.trim() || '', email?.trim() || '', notes?.trim() || '']
    );

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Tambah Pelanggan',
      `Menambahkan pelanggan baru: ${name.trim()}`,
      req.ip
    );

    const newCustomer = queryOne('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowId]);

    return res.status(201).json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan',
      data: newCustomer,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan pelanggan: ' + err.message });
  }
});

apiRouter.put('/customers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email, notes } = req.body;

    const existing = queryOne('SELECT id FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan/perusahaan wajib diisi' });
    }

    runQuery(
      `UPDATE customers
       SET name = ?, address = ?, phone = ?, email = ?, notes = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [name.trim(), address?.trim() || '', phone?.trim() || '', email?.trim() || '', notes?.trim() || '', id]
    );

    logActivity(req.user?.id || null, req.user?.username || 'admin', 'Edit Pelanggan', `Mengubah data pelanggan ID ${id} (${name.trim()})`, req.ip);

    return res.json({ success: true, message: 'Data pelanggan berhasil diperbarui' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pelanggan: ' + err.message });
  }
});

// Delete all customers (clear customer database)
apiRouter.delete('/customers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    // Safely unlink customer_id from past invoices so transaction history is fully retained
    runQuery('UPDATE invoices SET customer_id = NULL');
    runQuery('DELETE FROM customers');
    saveDb();

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Database Pelanggan',
      `Seluruh data pelanggan berhasil dihapus oleh ${req.user?.full_name || 'Admin'}`,
      ip
    );

    return res.json({ success: true, message: 'Seluruh database pelanggan berhasil dihapus' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus database pelanggan: ' + err.message });
  }
});

apiRouter.delete('/customers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = queryOne<any>('SELECT * FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    // Safely unlink customer_id from past invoices so history is fully retained
    runQuery('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?', [id]);

    // Delete customer
    runQuery('DELETE FROM customers WHERE id = ?', [id]);
    saveDb();

    logActivity(req.user?.id || null, req.user?.username || 'admin', 'Hapus Pelanggan', `Menghapus pelanggan ${existing.name}`, req.ip);

    return res.json({ success: true, message: `Pelanggan '${existing.name}' berhasil dihapus` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan: ' + err.message });
  }
});

// Bulk delete customers
apiRouter.post('/customers/bulk-delete', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar ID pelanggan tidak valid' });
    }

    let deletedCount = 0;
    for (const id of ids) {
      runQuery('UPDATE invoices SET customer_id = NULL WHERE customer_id = ?', [id]);
      const result = runQuery('DELETE FROM customers WHERE id = ?', [id]);
      if (result.changes > 0) deletedCount++;
    }
    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Masal Pelanggan',
      `Menghapus ${deletedCount} pelanggan dari database`,
      req.ip
    );

    return res.json({
      success: true,
      message: `${deletedCount} pelanggan berhasil dihapus`,
      deletedCount,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pelanggan masal: ' + err.message });
  }
});

// Export customers to Excel
apiRouter.get('/customers/export', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const customers = queryAll(`
      SELECT c.name, c.address, c.phone, c.email, c.notes, COUNT(i.id) as invoice_count, COALESCE(SUM(i.total_amount), 0) as total_spent
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'cancelled'
      GROUP BY c.id
      ORDER BY c.id ASC
    `);

    const exportData = customers.map((c, idx) => ({
      No: idx + 1,
      'Nama Pelanggan': c.name,
      Alamat: c.address || '-',
      'No Telepon': c.phone || '-',
      Email: c.email || '-',
      'Total Transaksi Invoice': c.invoice_count,
      'Total Nilai Pembelian (Rp)': c.total_spent,
      Catatan: c.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pelanggan');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Daftar-Pelanggan-${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengekspor pelanggan: ' + err.message });
  }
});

// ==========================================
// 6. INVOICE GENERATION & MANAGEMENT ROUTES
// ==========================================

// Generate next invoice number
apiRouter.get('/invoices/next-number', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = queryOne<any>('SELECT * FROM invoice_settings WHERE id = 1');
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    // Count invoices this month to determine sequence
    const countRow = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM invoices WHERE activity_date LIKE ?`,
      [`${yyyy}-${mm}%`]
    );
    let nextSeq = (countRow?.count || 0) + (settings?.start_number || 1);
    const format = settings?.number_format || 'INV/{YYYY}/{MM}/{NUMBER}';
    let invoiceNumber = '';

    // Loop until we find a unique number that does not exist in SQLite
    for (let attempts = 0; attempts < 1000; attempts++) {
      const seqStr = String(nextSeq).padStart(4, '0');
      invoiceNumber = format
        .replace('{YYYY}', yyyy)
        .replace('{MM}', mm)
        .replace('{DD}', dd)
        .replace('{NUMBER}', seqStr);

      const exists = queryOne('SELECT id FROM invoices WHERE LOWER(invoice_number) = LOWER(?)', [invoiceNumber.trim()]);
      if (!exists) {
        break;
      }
      nextSeq++;
    }

    return res.json({
      success: true,
      invoiceNumber,
      format,
      nextSequence: nextSeq,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghasilkan nomor invoice: ' + err.message });
  }
});

// Get invoices list with filtering
apiRouter.get('/invoices', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, start_date, end_date, customer_id, page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_address LIKE ?)');
      const s = `%${(search as string).trim()}%`;
      params.push(s, s, s);
    }

    if (status && status !== 'all') {
      whereClauses.push('i.status = ?');
      params.push(status);
    }

    if (start_date) {
      whereClauses.push('i.activity_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereClauses.push('i.activity_date <= ?');
      params.push(end_date);
    }

    if (customer_id) {
      whereClauses.push('i.customer_id = ?');
      params.push(customer_id);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM invoices i ${whereSql}`, params);
    const total = countRow?.total || 0;

    const dataQuery = `
      SELECT i.*, COUNT(ii.id) as item_count, SUM(ii.qty) as total_qty, u.full_name as created_by_name
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN users u ON i.created_by_user_id = u.id
      ${whereSql}
      GROUP BY i.id
      ORDER BY i.id DESC
      LIMIT ? OFFSET ?
    `;

    const invoices = queryAll(dataQuery, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar invoice: ' + err.message });
  }
});

// ==========================================
// PUBLIC INVOICE RESOLVER & SERVER-SIDE PDF GENERATOR
// ==========================================

function fetchPublicInvoiceData(rawIdentifier?: string, idParam?: any) {
  let invoice: any = null;
  const rawId = idParam ? Number(idParam) : -1;
  const validId = !isNaN(rawId) && rawId > 0 ? rawId : -1;

  // 1. Direct ID match if numeric ID is provided
  if (validId > 0) {
    invoice = queryOne<any>(
      `SELECT i.*, u.full_name as created_by_name
       FROM invoices i
       LEFT JOIN users u ON i.created_by_user_id = u.id
       WHERE i.id = ?`,
      [validId]
    );
  }

  // 2. Lookup by identifier / invoice_number
  if (!invoice && rawIdentifier) {
    const rawVal = decodeURIComponent(rawIdentifier).trim();
    const asNum = !isNaN(Number(rawVal)) ? Number(rawVal) : -1;

    // Exact invoice_number or ID
    invoice = queryOne<any>(
      `SELECT i.*, u.full_name as created_by_name
       FROM invoices i
       LEFT JOIN users u ON i.created_by_user_id = u.id
       WHERE i.invoice_number = ? OR (i.id = ? AND ? > 0)`,
      [rawVal, asNum, asNum]
    );

    // Case-insensitive match
    if (!invoice) {
      invoice = queryOne<any>(
        `SELECT i.*, u.full_name as created_by_name
         FROM invoices i
         LEFT JOIN users u ON i.created_by_user_id = u.id
         WHERE LOWER(TRIM(i.invoice_number)) = LOWER(?)`,
        [rawVal]
      );
    }

    // Normalized match (strip /, -, _, space)
    if (!invoice) {
      const cleanInput = rawVal.replace(/[\/\-_ \s]/g, '').toLowerCase();
      if (cleanInput.length >= 3) {
        const allInvs = queryAll<any>(
          `SELECT i.*, u.full_name as created_by_name FROM invoices i LEFT JOIN users u ON i.created_by_user_id = u.id`
        );
        invoice =
          allInvs.find((inv) => {
            const cleanInv = (inv.invoice_number || '').replace(/[\/\-_ \s]/g, '').toLowerCase();
            return cleanInv === cleanInput || cleanInv.endsWith(cleanInput) || cleanInput.endsWith(cleanInv);
          }) || null;
      }
    }
  }

  if (!invoice) return null;

  const items = queryAll(
    `SELECT ii.*, p.stock as current_product_stock
     FROM invoice_items ii
     LEFT JOIN products p ON ii.product_id = p.id
     WHERE ii.invoice_id = ?
     ORDER BY ii.id ASC`,
    [invoice.id]
  );

  const company = queryOne('SELECT * FROM company_settings WHERE id = 1');
  const settings = queryOne<any>('SELECT * FROM invoice_settings WHERE id = 1');

  let paymentMethods = DEFAULT_PAYMENT_METHODS;
  if (settings?.payment_methods) {
    try {
      paymentMethods = JSON.parse(settings.payment_methods);
    } catch {
      paymentMethods = DEFAULT_PAYMENT_METHODS;
    }
  }

  return {
    ...invoice,
    items,
    company,
    settings: {
      ...settings,
      whatsapp_template: settings?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
      payment_methods: paymentMethods,
    },
    payment_methods: paymentMethods,
  };
}

function generateServerInvoicePdf(data: any): Buffer {
  const JsPDFClass: any = (jsPDF as any).jsPDF || (jsPDF as any).default || jsPDF;
  const runAutoTable: any = (autoTable as any).default || autoTable;
  const doc = new JsPDFClass({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // 1. Header Banner (Solid Forest Green Brand)
  const headerHeight = 36;
  doc.setFillColor(19, 98, 57); // #136239
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.company?.company_name || 'Info Papandayan', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 252, 231);
  const companyAddress = data.company?.address || 'Jl. Kawah Papandayan, Karamat Wangi, Cisurupan, Kab. Garut';
  doc.text(companyAddress, margin, 19);

  const phoneWeb = `WhatsApp: ${data.company?.phone || '+62 822-4063-0123'}  |  Website: ${data.company?.website || 'https://infopapandayan.com'}`;
  doc.text(phoneWeb, margin, 24);

  const bankHeader = `Bank Mandiri: ${data.bank_account_no || '131-00-1849201-8'} (a.n. Info Papandayan)`;
  doc.text(bankHeader, margin, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('FAKTUR INVOICE RESMI', pageWidth - margin, 15, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 252, 231);
  doc.text('Dokumen Penagihan Sah', pageWidth - margin, 21, { align: 'right' });

  // 2. Client & Transaction Details
  const infoY = headerHeight + 5;

  // Left: Bill To
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, infoY, 92, 26, 1.5, 1.5, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, infoY, 92, 26, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(19, 98, 57);
  doc.text('DITAGIHKAN KEPADA (KLIEN):', margin + 3.5, infoY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const custNameLines = doc.splitTextToSize(data.customer_name || 'Pelanggan', 85);
  doc.text(custNameLines, margin + 3.5, infoY + 12);

  if (data.customer_phone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`No. Kontak: ${data.customer_phone}`, margin + 3.5, infoY + 21);
  }

  // Right: Transaction Details
  const rightX = pageWidth - margin - 88;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX, infoY, 88, 26, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, infoY, 88, 26, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(19, 98, 57);
  doc.text('DETAIL TRANSAKSI & FAKTUR:', rightX + 3.5, infoY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Nomor Faktur', rightX + 3.5, infoY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 98, 57);
  doc.text(`: ${data.invoice_number}`, rightX + 26, infoY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Tanggal', rightX + 3.5, infoY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${formatDateIndo(data.activity_date)}`, rightX + 26, infoY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Status', rightX + 3.5, infoY + 20);
  doc.setFont('helvetica', 'bold');
  if (data.status === 'paid') {
    doc.setTextColor(22, 101, 52);
    doc.text(': LUNAS (PAID)', rightX + 26, infoY + 20);
  } else {
    doc.setTextColor(180, 83, 9);
    doc.text(': MENUNGGU PEMBAYARAN', rightX + 26, infoY + 20);
  }

  // 3. Items Table
  const tableStartY = infoY + 29;
  const tableBody = (data.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.product_name,
    `${item.qty} ${item.unit || 'Pcs'}`,
    formatRupiah(item.price),
    formatRupiah(item.subtotal),
  ]);

  runAutoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['No', 'Deskripsi Barang / Layanan', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [209, 250, 229],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [19, 98, 57],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 35;

  // 4. Terbilang & Payments (Left) + Totals (Right)
  // Left: Terbilang
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, finalY + 4, 102, 11, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, finalY + 4, 102, 11, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('TERBILANG:', margin + 3, finalY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(19, 98, 57);
  const terbilangLines = doc.splitTextToSize(`"${terbilang(data.total_amount)}"`, 96);
  doc.text(terbilangLines, margin + 3, finalY + 12);

  // Left: Payment methods
  const activeMethods = (data.payment_methods || []).filter((m: any) => m.is_active);
  let payBoxHeight = Math.min(26, 9 + (activeMethods.length || 1) * 4.5);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, finalY + 17, 102, payBoxHeight, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, finalY + 17, 102, payBoxHeight, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(19, 98, 57);
  doc.text('METODE PEMBAYARAN RESMI:', margin + 3, finalY + 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  let payLineY = finalY + 25;
  if (activeMethods.length > 0) {
    activeMethods.slice(0, 3).forEach((m: any) => {
      doc.text(`• ${m.name}: ${m.account_no} (a.n. ${m.account_name})`, margin + 3, payLineY);
      payLineY += 4.5;
    });
  } else {
    doc.text(`Bank Mandiri: ${data.bank_account_no || '131-00-1849201-8'} (a.n. Info Papandayan)`, margin + 3, payLineY);
  }

  // Right: Summary & Total
  const sumX = pageWidth - margin - 65;
  let currSumY = finalY + 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', sumX, currSumY);
  doc.setFont('helvetica', 'bold');
  doc.text(formatRupiah(data.subtotal || 0), pageWidth - margin, currSumY, { align: 'right' });

  if (data.discount_amount > 0) {
    currSumY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text('Potongan Diskon', sumX, currSumY);
    doc.text(`- ${formatRupiah(data.discount_amount)}`, pageWidth - margin, currSumY, { align: 'right' });
  }

  currSumY += 7;
  // Total Highlight Box
  doc.setFillColor(19, 98, 57);
  doc.roundedRect(sumX - 2, currSumY - 4, 67, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TAGIHAN', sumX, currSumY + 2.5);
  doc.text(formatRupiah(data.total_amount), pageWidth - margin - 1, currSumY + 2.5, { align: 'right' });

  // Notes
  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(19, 98, 57);
    doc.text('CATATAN / KETENTUAN:', margin, finalY + 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(splitNotes, margin, finalY + 50);
  }

  // Footer Banner / Bottom bar
  doc.setFillColor(19, 98, 57);
  doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `© ${new Date().getFullYear()} ${data.company?.company_name || 'Info Papandayan'}. Faktur resmi diterbitkan secara elektronik.`,
    pageWidth / 2,
    pageHeight - 3,
    { align: 'center' }
  );

  return Buffer.from(doc.output('arraybuffer'));
}

// 1. Direct PDF download endpoint (streams PDF binary directly to browser/WhatsApp)
apiRouter.get('/invoices/public/pdf', (req: Request, res: Response) => {
  try {
    const rawVal = (req.query.inv || req.query.invoice || req.query.number || req.query.identifier || '') as string;
    const invoice = fetchPublicInvoiceData(rawVal, req.query.id);
    if (!invoice) {
      return res.status(404).send('Faktur invoice tidak ditemukan atau tautan telah kedaluwarsa.');
    }
    const pdfBuffer = generateServerInvoicePdf(invoice);
    const safeNum = (invoice.invoice_number || 'INV').replace(/[\/\\]/g, '-');
    const isAttachment = req.query.download === '1' || req.query.attachment === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${isAttachment ? 'attachment' : 'inline'}; filename="Invoice-${safeNum}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err: any) {
    return res.status(500).send('Gagal mengunduh file PDF: ' + err.message);
  }
});

apiRouter.get('/invoices/public/download-pdf', (req: Request, res: Response) => {
  try {
    const rawVal = (req.query.inv || req.query.invoice || req.query.number || req.query.identifier || '') as string;
    const invoice = fetchPublicInvoiceData(rawVal, req.query.id);
    if (!invoice) {
      return res.status(404).send('Faktur invoice tidak ditemukan atau tautan telah kedaluwarsa.');
    }
    const pdfBuffer = generateServerInvoicePdf(invoice);
    const safeNum = (invoice.invoice_number || 'INV').replace(/[\/\\]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${safeNum}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err: any) {
    return res.status(500).send('Gagal mengunduh file PDF: ' + err.message);
  }
});

// Direct PDF download routes (without /invoices/public prefix)
const handleDirectPdf = (req: Request, res: Response) => {
  try {
    const rawVal = (req.query.inv || req.query.invoice || req.query.number || req.query.identifier || req.params.identifier || req.query.no || req.query.faktur || '') as string;
    const invoice = fetchPublicInvoiceData(rawVal, req.query.id);
    if (!invoice) {
      return res.status(404).send('Faktur invoice tidak ditemukan atau tautan telah kedaluwarsa.');
    }
    const pdfBuffer = generateServerInvoicePdf(invoice);
    const safeNum = (invoice.invoice_number || 'INV').replace(/[\/\\]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${safeNum}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err: any) {
    return res.status(500).send('Gagal mengunduh file PDF: ' + err.message);
  }
};

apiRouter.get('/download-pdf', handleDirectPdf);
apiRouter.get('/unduh-pdf', handleDirectPdf);
apiRouter.get('/faktur-pdf', handleDirectPdf);
apiRouter.get('/pdf/:identifier', handleDirectPdf);

// 2. Public invoice JSON endpoint via query parameters
apiRouter.get('/invoices/public', (req: Request, res: Response) => {
  try {
    const rawVal = (req.query.inv || req.query.invoice || req.query.number || req.query.identifier || req.query.no || req.query.faktur || '') as string;
    const invoice = fetchPublicInvoiceData(rawVal, req.query.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Faktur invoice tidak ditemukan atau telah dihapus' });
    }
    return res.json({ success: true, data: invoice });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail invoice publik: ' + err.message });
  }
});

// 3. Public invoice wildcard route (matches /invoices/public/INV/2026/10/0001, /invoices/public/1, etc.)
apiRouter.get('/invoices/public/*', (req: Request, res: Response) => {
  try {
    const wildcardPath = req.params[0] || '';
    if (wildcardPath.endsWith('/pdf') || wildcardPath.endsWith('/download')) {
      const cleanPath = wildcardPath.replace(/\/(pdf|download)$/, '');
      const invoice = fetchPublicInvoiceData(cleanPath, req.query.id);
      if (!invoice) return res.status(404).send('Faktur invoice tidak ditemukan');
      const pdfBuffer = generateServerInvoicePdf(invoice);
      const safeNum = (invoice.invoice_number || 'INV').replace(/[\/\\]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Invoice-${safeNum}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    const invoice = fetchPublicInvoiceData(wildcardPath, req.query.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Faktur invoice tidak ditemukan atau telah dihapus' });
    }
    return res.json({ success: true, data: invoice });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail invoice: ' + err.message });
  }
});

// Get single invoice details with items and company settings
apiRouter.get('/invoices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = queryOne<any>(
      `SELECT i.*, u.full_name as created_by_name
       FROM invoices i
       LEFT JOIN users u ON i.created_by_user_id = u.id
       WHERE i.id = ?`,
      [id]
    );

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
    }

    const items = queryAll(
      `SELECT ii.*, p.stock as current_product_stock
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = ?
       ORDER BY ii.id ASC`,
      [id]
    );

    const company = queryOne('SELECT * FROM company_settings WHERE id = 1');
    const settings = queryOne<any>('SELECT * FROM invoice_settings WHERE id = 1');

    let paymentMethods = DEFAULT_PAYMENT_METHODS;
    if (settings?.payment_methods) {
      try {
        paymentMethods = JSON.parse(settings.payment_methods);
      } catch {
        paymentMethods = DEFAULT_PAYMENT_METHODS;
      }
    }

    return res.json({
      success: true,
      data: {
        ...invoice,
        items,
        company,
        settings: {
          ...settings,
          whatsapp_template: settings?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
          payment_methods: paymentMethods,
        },
        payment_methods: paymentMethods,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail invoice: ' + err.message });
  }
});

// Create new invoice
apiRouter.post('/invoices', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      invoice_number,
      customer_id,
      customer_name,
      customer_address,
      customer_phone,
      activity_date,
      due_date,
      bank_account_no,
      bank_name,
      bank_account_name,
      notes,
      discount_type = 'fixed',
      discount_rate = 0,
      tax_percent = 11,
      status = 'paid',
      items,
    } = req.body;

    if (!invoice_number || !invoice_number.trim()) {
      return res.status(400).json({ success: false, message: 'Nomor invoice wajib diisi' });
    }

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan/penerima invoice wajib diisi' });
    }

    if (!activity_date) {
      return res.status(400).json({ success: false, message: 'Tanggal kegiatan/invoice wajib diisi' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invoice harus memiliki minimal 1 barang/produk' });
    }

    // Check duplicate invoice number
    const dupCheck = queryOne('SELECT id FROM invoices WHERE LOWER(invoice_number) = LOWER(?)', [invoice_number.trim()]);
    if (dupCheck) {
      return res.status(400).json({ success: false, message: `Nomor invoice '${invoice_number}' sudah ada sebelumnya` });
    }

    // Validate and calculate items
    let subtotal = 0;
    const validatedItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = parseInt(it.qty);
      const price = parseFloat(it.price);

      if (!it.product_name || !it.product_name.trim()) {
        return res.status(400).json({ success: false, message: `Baris ${i + 1}: Nama barang tidak boleh kosong` });
      }

      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: `Baris ${i + 1}: Jumlah/Qty harus angka lebih dari 0` });
      }

      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, message: `Baris ${i + 1}: Harga tidak boleh negatif` });
      }

      const itemSubtotal = qty * price;
      subtotal += itemSubtotal;

      // Validate product_id against products table to avoid SQLite foreign key constraint failure
      let validProductId: number | null = null;
      if (it.product_id) {
        const parsedPid = parseInt(it.product_id, 10);
        if (!isNaN(parsedPid) && parsedPid > 0) {
          const pCheck = queryOne('SELECT id FROM products WHERE id = ?', [parsedPid]);
          if (pCheck) {
            validProductId = pCheck.id;
          }
        }
      }

      // If manual product and user chose save_to_db, automatically insert into products
      if (!validProductId && it.save_to_db && it.product_name.trim()) {
        try {
          const autoCode = (it.product_code && it.product_code !== 'MANUAL' && it.product_code !== 'CUSTOM')
            ? it.product_code.trim().toUpperCase()
            : `PRD-${Date.now().toString().slice(-4)}`;
          let finalProdCode = autoCode;
          let counter = 1;
          while (queryOne('SELECT id FROM products WHERE LOWER(code) = LOWER(?)', [finalProdCode])) {
            finalProdCode = `${autoCode}-${counter++}`;
          }
          const newProd = runQuery(
            `INSERT INTO products (code, name, unit, price, stock, status, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', 'Ditambahkan otomatis dari pembuatan invoice', datetime('now', 'localtime'), datetime('now', 'localtime'))`,
            [finalProdCode, it.product_name.trim(), it.unit?.trim() || 'Pcs', price, 0]
          );
          if (newProd.lastInsertRowId) {
            validProductId = newProd.lastInsertRowId;
          }
        } catch (e) {
          console.warn('Could not auto-save manual product to DB:', e);
        }
      }

      validatedItems.push({
        product_id: validProductId,
        product_code: it.product_code?.trim() || (validProductId ? 'PRD' : 'MANUAL'),
        product_name: it.product_name.trim(),
        qty,
        unit: it.unit?.trim() || 'Pcs',
        price,
        subtotal: itemSubtotal,
      });
    }

    // Calculations
    let discountAmount = 0;
    const numDiscountRate = parseFloat(discount_rate) || 0;
    if (discount_type === 'percent') {
      discountAmount = Math.round((subtotal * numDiscountRate) / 100);
    } else {
      discountAmount = Math.min(subtotal, numDiscountRate);
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const numTaxPercent = parseFloat(tax_percent) || 0;
    const taxAmount = Math.round((afterDiscount * numTaxPercent) / 100);
    const totalAmount = afterDiscount + taxAmount;

    // Get company default bank if not provided
    const comp = queryOne<any>('SELECT * FROM company_settings WHERE id = 1');
    const finalBankAcc = bank_account_no || comp?.bank_account_no || '';
    const finalBankName = bank_name || comp?.bank_name || '';
    const finalBankNameOwner = bank_account_name || comp?.bank_account_name || '';

    // Validate customer_id exists to avoid SQLite foreign key constraint failures
    let finalCustomerId: number | null = null;
    if (customer_id && !isNaN(parseInt(customer_id))) {
      const checkCust = queryOne<any>('SELECT id FROM customers WHERE id = ?', [parseInt(customer_id)]);
      if (checkCust) {
        finalCustomerId = checkCust.id;
      }
    }

    const safeCustomerName = (customer_name && customer_name.trim()) || 'Pelanggan';

    // Insert invoice
    const invResult = runQuery(
      `INSERT INTO invoices (
        invoice_number, customer_id, customer_name, customer_address, customer_phone,
        activity_date, due_date, bank_account_no, bank_name, bank_account_name,
        notes, subtotal, discount_type, discount_rate, discount_amount,
        tax_percent, tax_amount, total_amount, status, created_by_user_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [
        invoice_number.trim(),
        finalCustomerId,
        safeCustomerName,
        customer_address?.trim() || '',
        customer_phone?.trim() || '',
        activity_date,
        due_date || activity_date,
        finalBankAcc,
        finalBankName,
        finalBankNameOwner,
        notes?.trim() || '',
        subtotal,
        discount_type,
        numDiscountRate,
        discountAmount,
        numTaxPercent,
        taxAmount,
        totalAmount,
        status,
        req.user?.id || 1,
      ]
    );

    const invoiceId = invResult.lastInsertRowId;

    // Insert items & reduce product stock
    for (const it of validatedItems) {
      runQuery(
        `INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, unit, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceId, it.product_id, it.product_code, it.product_name, it.qty, it.unit, it.price, it.subtotal]
      );

      // Reduce product stock if product_id exists
      if (it.product_id) {
        runQuery(
          `UPDATE products
           SET stock = MAX(0, stock - ?), updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [it.qty, it.product_id]
        );
      }
    }

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Membuat Invoice',
      `Invoice baru No ${invoice_number.trim()} untuk ${customer_name.trim()} senilai Rp ${totalAmount.toLocaleString('id-ID')}`,
      req.ip
    );

    return res.status(201).json({
      success: true,
      message: 'Invoice berhasil dibuat dan disimpan',
      invoiceId,
      invoiceNumber: invoice_number.trim(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal membuat invoice: ' + err.message });
  }
});

// Update invoice
apiRouter.put('/invoices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      invoice_number,
      customer_id,
      customer_name,
      customer_address,
      customer_phone,
      activity_date,
      due_date,
      bank_account_no,
      bank_name,
      bank_account_name,
      notes,
      discount_type = 'fixed',
      discount_rate = 0,
      tax_percent = 11,
      status,
      items,
    } = req.body;

    const existingInv = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!existingInv) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
    }

    if (!invoice_number || !invoice_number.trim()) {
      return res.status(400).json({ success: false, message: 'Nomor invoice wajib diisi' });
    }

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invoice harus memiliki minimal 1 barang' });
    }

    // Check duplicate invoice number on other invoice
    const dupCheck = queryOne('SELECT id FROM invoices WHERE LOWER(invoice_number) = LOWER(?) AND id != ?', [invoice_number.trim(), id]);
    if (dupCheck) {
      return res.status(400).json({ success: false, message: `Nomor invoice '${invoice_number}' sudah ada sebelumnya` });
    }

    // Return previous stock from old items
    const oldItems = queryAll<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
    for (const oldIt of oldItems) {
      if (oldIt.product_id) {
        runQuery('UPDATE products SET stock = stock + ? WHERE id = ?', [oldIt.qty, oldIt.product_id]);
      }
    }

    // Delete old items
    runQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

    // Validate and calculate new items
    let subtotal = 0;
    const validatedItems: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = parseInt(it.qty);
      const price = parseFloat(it.price);

      if (!it.product_name || !it.product_name.trim()) {
        return res.status(400).json({ success: false, message: `Baris ${i + 1}: Nama barang tidak boleh kosong` });
      }

      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: `Baris ${i + 1}: Jumlah/Qty harus angka lebih dari 0` });
      }

      const itemSubtotal = qty * (isNaN(price) ? 0 : price);
      subtotal += itemSubtotal;

      // Validate product_id against products table to avoid SQLite foreign key constraint failure
      let validProductId: number | null = null;
      if (it.product_id) {
        const parsedPid = parseInt(it.product_id, 10);
        if (!isNaN(parsedPid) && parsedPid > 0) {
          const pCheck = queryOne('SELECT id FROM products WHERE id = ?', [parsedPid]);
          if (pCheck) {
            validProductId = pCheck.id;
          }
        }
      }

      // If manual product and user chose save_to_db, automatically insert into products
      if (!validProductId && it.save_to_db && it.product_name.trim()) {
        try {
          const autoCode = (it.product_code && it.product_code !== 'MANUAL' && it.product_code !== 'CUSTOM')
            ? it.product_code.trim().toUpperCase()
            : `PRD-${Date.now().toString().slice(-4)}`;
          let finalProdCode = autoCode;
          let counter = 1;
          while (queryOne('SELECT id FROM products WHERE LOWER(code) = LOWER(?)', [finalProdCode])) {
            finalProdCode = `${autoCode}-${counter++}`;
          }
          const newProd = runQuery(
            `INSERT INTO products (code, name, unit, price, stock, status, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', 'Ditambahkan otomatis dari edit invoice', datetime('now', 'localtime'), datetime('now', 'localtime'))`,
            [finalProdCode, it.product_name.trim(), it.unit?.trim() || 'Pcs', isNaN(price) ? 0 : price, 0]
          );
          if (newProd.lastInsertRowId) {
            validProductId = newProd.lastInsertRowId;
          }
        } catch (e) {
          console.warn('Could not auto-save manual product to DB:', e);
        }
      }

      validatedItems.push({
        product_id: validProductId,
        product_code: it.product_code?.trim() || (validProductId ? 'PRD' : 'MANUAL'),
        product_name: it.product_name.trim(),
        qty,
        unit: it.unit?.trim() || 'Pcs',
        price: isNaN(price) ? 0 : price,
        subtotal: itemSubtotal,
      });
    }

    let discountAmount = 0;
    const numDiscountRate = parseFloat(discount_rate) || 0;
    if (discount_type === 'percent') {
      discountAmount = Math.round((subtotal * numDiscountRate) / 100);
    } else {
      discountAmount = Math.min(subtotal, numDiscountRate);
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const numTaxPercent = parseFloat(tax_percent) || 0;
    const taxAmount = Math.round((afterDiscount * numTaxPercent) / 100);
    const totalAmount = afterDiscount + taxAmount;

    // Validate customer_id exists to avoid SQLite foreign key constraint failures
    let finalCustomerId: number | null = null;
    if (customer_id && !isNaN(parseInt(customer_id))) {
      const checkCust = queryOne<any>('SELECT id FROM customers WHERE id = ?', [parseInt(customer_id)]);
      if (checkCust) {
        finalCustomerId = checkCust.id;
      }
    }

    const safeCustomerName = (customer_name && customer_name.trim()) || 'Pelanggan';

    // Update invoice record
    runQuery(
      `UPDATE invoices
       SET invoice_number = ?, customer_id = ?, customer_name = ?, customer_address = ?, customer_phone = ?,
           activity_date = ?, due_date = ?, bank_account_no = ?, bank_name = ?, bank_account_name = ?,
           notes = ?, subtotal = ?, discount_type = ?, discount_rate = ?, discount_amount = ?,
           tax_percent = ?, tax_amount = ?, total_amount = ?, status = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [
        invoice_number.trim(),
        finalCustomerId,
        safeCustomerName,
        customer_address?.trim() || '',
        customer_phone?.trim() || '',
        activity_date,
        due_date || activity_date,
        bank_account_no || '',
        bank_name || '',
        bank_account_name || '',
        notes?.trim() || '',
        subtotal,
        discount_type,
        numDiscountRate,
        discountAmount,
        numTaxPercent,
        taxAmount,
        totalAmount,
        status || existingInv.status,
        id,
      ]
    );

    // Insert new items and deduct stock
    for (const it of validatedItems) {
      runQuery(
        `INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, unit, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, it.product_id, it.product_code, it.product_name, it.qty, it.unit, it.price, it.subtotal]
      );

      if (it.product_id) {
        runQuery(
          `UPDATE products
           SET stock = MAX(0, stock - ?), updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
          [it.qty, it.product_id]
        );
      }
    }

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Mengedit Invoice',
      `Memperbarui Invoice No ${invoice_number.trim()} (ID: ${id})`,
      req.ip
    );

    return res.json({ success: true, message: 'Invoice berhasil diperbarui' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui invoice: ' + err.message });
  }
});

// Delete invoice
apiRouter.delete('/invoices/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
    }

    // Restore stock from deleted invoice
    const items = queryAll<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
    for (const it of items) {
      if (it.product_id) {
        runQuery('UPDATE products SET stock = stock + ? WHERE id = ?', [it.qty, it.product_id]);
      }
    }

    // Delete invoice items and invoice
    runQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    runQuery('DELETE FROM invoices WHERE id = ?', [id]);

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Menghapus Invoice',
      `Menghapus Invoice No ${invoice.invoice_number} (Klien: ${invoice.customer_name})`,
      req.ip
    );

    return res.json({ success: true, message: 'Invoice berhasil dihapus dan stok barang dikembalikan' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus invoice: ' + err.message });
  }
});

// Bulk delete invoices
apiRouter.post('/invoices/bulk-delete', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar ID invoice tidak valid' });
    }

    let deletedCount = 0;
    for (const id of ids) {
      const invoice = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [id]);
      if (!invoice) continue;

      // Restore stock from deleted invoice
      const items = queryAll<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
      for (const it of items) {
        if (it.product_id) {
          runQuery('UPDATE products SET stock = stock + ? WHERE id = ?', [it.qty, it.product_id]);
        }
      }

      runQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      const result = runQuery('DELETE FROM invoices WHERE id = ?', [id]);
      if (result.changes > 0) deletedCount++;
    }
    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Masal Invoice',
      `Menghapus ${deletedCount} faktur invoice dan mengembalikan stok barang terkait`,
      req.ip
    );

    return res.json({
      success: true,
      message: `${deletedCount} invoice berhasil dihapus dan stok barang telah dikembalikan`,
      deletedCount,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus invoice masal: ' + err.message });
  }
});

// Export invoices list to Excel
apiRouter.get('/invoices/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoices = queryAll(`
      SELECT i.invoice_number, i.customer_name, i.activity_date, i.subtotal, i.discount_amount,
             i.tax_amount, i.total_amount, i.status, COUNT(ii.id) as item_count, SUM(ii.qty) as total_qty
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      GROUP BY i.id
      ORDER BY i.id DESC
    `);

    const exportData = invoices.map((inv, idx) => ({
      No: idx + 1,
      'Nomor Invoice': inv.invoice_number,
      'Nama Klien / Penerima': inv.customer_name,
      'Tanggal Kegiatan': inv.activity_date,
      'Jumlah Jenis Barang': inv.item_count,
      'Total Qty Barang': inv.total_qty,
      'Subtotal (Rp)': inv.subtotal,
      'Diskon (Rp)': inv.discount_amount,
      'PPN / Pajak (Rp)': inv.tax_amount,
      'Total Nilai (Rp)': inv.total_amount,
      Status: inv.status === 'paid' ? 'Lunas' : inv.status === 'pending' ? 'Menunggu' : inv.status === 'cancelled' ? 'Dibatalkan' : 'Draft',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Invoice');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Daftar-Invoice-${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengekspor invoice: ' + err.message });
  }
});

// ==========================================
// 7. LAPORAN BARANG KELUAR ROUTES
// ==========================================

apiRouter.get('/reports/items-out', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_date, end_date, customer_name, product_id, category_id, invoice_number, page = '1', limit = '15' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 15));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = ["i.status != 'cancelled'"];
    let params: any[] = [];

    if (start_date) {
      whereClauses.push('i.activity_date >= ?');
      params.push(start_date);
    }

    if (end_date) {
      whereClauses.push('i.activity_date <= ?');
      params.push(end_date);
    }

    if (customer_name) {
      whereClauses.push('i.customer_name LIKE ?');
      params.push(`%${(customer_name as string).trim()}%`);
    }

    if (product_id) {
      whereClauses.push('ii.product_id = ?');
      params.push(product_id);
    }

    if (category_id) {
      whereClauses.push('p.category_id = ?');
      params.push(category_id);
    }

    if (invoice_number) {
      whereClauses.push('i.invoice_number LIKE ?');
      params.push(`%${(invoice_number as string).trim()}%`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Overall summary metrics for filtered range
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT i.id) as total_transaksi,
        COUNT(DISTINCT ii.product_name) as total_jenis_barang,
        COALESCE(SUM(ii.qty), 0) as total_qty_keluar,
        COALESCE(SUM(ii.subtotal), 0) as total_nilai_keluar
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      ${whereSql}
    `;

    const summary = queryOne(summaryQuery, params) || {
      total_transaksi: 0,
      total_jenis_barang: 0,
      total_qty_keluar: 0,
      total_nilai_keluar: 0,
    };

    // Count items rows
    const countQuery = `
      SELECT COUNT(*) as total
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      ${whereSql}
    `;
    const countRow = queryOne<{ total: number }>(countQuery, params);
    const total = countRow?.total || 0;

    // Paginated list
    const dataQuery = `
      SELECT
        ii.id as item_id,
        i.id as invoice_id,
        i.activity_date as tanggal,
        i.invoice_number as nomor_invoice,
        i.customer_name as nama_pelanggan,
        ii.product_code as kode_produk,
        ii.product_name as nama_barang,
        c.name as kategori,
        ii.qty as jumlah,
        ii.unit as satuan,
        ii.price as harga,
        ii.subtotal as total_nilai,
        i.status as invoice_status
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereSql}
      ORDER BY i.activity_date DESC, ii.id DESC
      LIMIT ? OFFSET ?
    `;

    const items = queryAll(dataQuery, [...params, limitNum, offset]);

    return res.json({
      success: true,
      summary,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat laporan barang keluar: ' + err.message });
  }
});

// Export Laporan Barang Keluar to Excel
apiRouter.get('/reports/items-out/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start_date, end_date, customer_name, product_id, category_id, invoice_number } = req.query;

    let whereClauses: string[] = ["i.status != 'cancelled'"];
    let params: any[] = [];

    if (start_date) {
      whereClauses.push('i.activity_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('i.activity_date <= ?');
      params.push(end_date);
    }
    if (customer_name) {
      whereClauses.push('i.customer_name LIKE ?');
      params.push(`%${(customer_name as string).trim()}%`);
    }
    if (product_id) {
      whereClauses.push('ii.product_id = ?');
      params.push(product_id);
    }
    if (category_id) {
      whereClauses.push('p.category_id = ?');
      params.push(category_id);
    }
    if (invoice_number) {
      whereClauses.push('i.invoice_number LIKE ?');
      params.push(`%${(invoice_number as string).trim()}%`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const dataQuery = `
      SELECT
        i.activity_date as tanggal,
        i.invoice_number as nomor_invoice,
        i.customer_name as nama_pelanggan,
        ii.product_code as kode_produk,
        ii.product_name as nama_barang,
        c.name as kategori,
        ii.qty as jumlah,
        ii.unit as satuan,
        ii.price as harga,
        ii.subtotal as total_nilai
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereSql}
      ORDER BY i.activity_date DESC, ii.id DESC
    `;

    const items = queryAll(dataQuery, params);

    const exportData = items.map((it, idx) => ({
      No: idx + 1,
      Tanggal: it.tanggal,
      'Nomor Invoice': it.nomor_invoice,
      'Nama Pelanggan': it.nama_pelanggan,
      'Kode Produk': it.kode_produk,
      'Nama Barang': it.nama_barang,
      Kategori: it.kategori || '-',
      'Qty Keluar': it.jumlah,
      Satuan: it.satuan,
      'Harga Satuan (Rp)': it.harga,
      'Total Nilai (Rp)': it.total_nilai,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Barang Keluar');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Laporan-Barang-Keluar-${new Date().toISOString().split('T')[0]}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengekspor laporan barang keluar: ' + err.message });
  }
});

// Delete single outgoing logistics item and restore stock
apiRouter.delete('/reports/items-out/:itemId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const item = queryOne<any>(
      `SELECT ii.*, i.invoice_number, i.customer_name, i.discount_type, i.discount_rate, i.tax_percent
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE ii.id = ?`,
      [itemId]
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Rincian barang keluar tidak ditemukan' });
    }

    // 1. Restore product stock if product_id is linked
    const qtyToRestore = Number(item.qty) || 0;
    if (item.product_id && qtyToRestore > 0) {
      runQuery(
        `UPDATE products SET stock = stock + ?, updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [qtyToRestore, item.product_id]
      );
    }

    // 2. Delete the item row
    runQuery('DELETE FROM invoice_items WHERE id = ?', [itemId]);

    // 3. Recalculate remaining invoice totals
    const remainingItems = queryAll<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [item.invoice_id]);
    const newSubtotal = remainingItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);

    let discountAmount = 0;
    const discRate = parseFloat(item.discount_rate) || 0;
    if (item.discount_type === 'percent') {
      discountAmount = Math.round((newSubtotal * discRate) / 100);
    } else {
      discountAmount = Math.min(newSubtotal, discRate);
    }

    const afterDiscount = Math.max(0, newSubtotal - discountAmount);
    const taxPercent = parseFloat(item.tax_percent) || 0;
    const taxAmount = Math.round((afterDiscount * taxPercent) / 100);
    const totalAmount = afterDiscount + taxAmount;

    runQuery(
      `UPDATE invoices
       SET subtotal = ?, discount_amount = ?, tax_amount = ?, total_amount = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [newSubtotal, discountAmount, taxAmount, totalAmount, item.invoice_id]
    );

    saveDb();

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Barang Keluar',
      `Menghapus item "${item.product_name}" (${qtyToRestore} ${item.unit}) dari invoice ${item.invoice_number}. Stok produk berhasil dikembalikan.`,
      ip
    );

    return res.json({
      success: true,
      message: `Rincian barang "${item.product_name}" berhasil dihapus. Stok sebanyak ${qtyToRestore} ${item.unit} telah dikembalikan.`,
      restoredQty: qtyToRestore,
      productId: item.product_id,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus rincian barang keluar: ' + err.message });
  }
});

// Batch delete outgoing logistics items and restore stock
apiRouter.post('/reports/items-out/delete-batch', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal satu rincian barang keluar untuk dihapus' });
    }

    let deletedCount = 0;
    let totalRestoredQty = 0;
    const affectedInvoiceIds = new Set<number>();
    const deletedItemNames: string[] = [];

    for (const itemId of itemIds) {
      const item = queryOne<any>(
        `SELECT ii.*, i.id as inv_id, i.invoice_number, i.discount_type, i.discount_rate, i.tax_percent
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         WHERE ii.id = ?`,
        [itemId]
      );

      if (!item) continue;

      // 1. Restore product stock if product_id is valid
      const qtyToRestore = Number(item.qty) || 0;
      if (item.product_id && qtyToRestore > 0) {
        runQuery(
          `UPDATE products SET stock = stock + ?, updated_at = datetime('now', 'localtime') WHERE id = ?`,
          [qtyToRestore, item.product_id]
        );
        totalRestoredQty += qtyToRestore;
      }

      // 2. Delete item row
      runQuery('DELETE FROM invoice_items WHERE id = ?', [itemId]);
      deletedCount++;
      affectedInvoiceIds.add(item.invoice_id);
      if (deletedItemNames.length < 5) {
        deletedItemNames.push(`${item.product_name} (${item.qty} ${item.unit})`);
      }
    }

    // 3. Recalculate each affected invoice
    for (const invId of affectedInvoiceIds) {
      const inv = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invId]);
      if (!inv) continue;

      const remainingItems = queryAll<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [invId]);
      const newSubtotal = remainingItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);

      let discountAmount = 0;
      const discRate = parseFloat(inv.discount_rate) || 0;
      if (inv.discount_type === 'percent') {
        discountAmount = Math.round((newSubtotal * discRate) / 100);
      } else {
        discountAmount = Math.min(newSubtotal, discRate);
      }

      const afterDiscount = Math.max(0, newSubtotal - discountAmount);
      const taxPercent = parseFloat(inv.tax_percent) || 0;
      const taxAmount = Math.round((afterDiscount * taxPercent) / 100);
      const totalAmount = afterDiscount + taxAmount;

      runQuery(
        `UPDATE invoices
         SET subtotal = ?, discount_amount = ?, tax_amount = ?, total_amount = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [newSubtotal, discountAmount, taxAmount, totalAmount, invId]
      );
    }

    saveDb();

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus Barang Keluar Massal',
      `Menghapus ${deletedCount} rincian barang keluar: ${deletedItemNames.join(', ')}${deletedCount > 5 ? '...' : ''}. Total ${totalRestoredQty} unit stok dikembalikan ke inventaris.`,
      ip
    );

    return res.json({
      success: true,
      message: `Berhasil menghapus ${deletedCount} rincian barang keluar dan mengembalikan ${totalRestoredQty} unit fisik ke stok inventaris.`,
      deletedCount,
      restoredQty: totalRestoredQty,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus rincian barang keluar massal: ' + err.message });
  }
});

// ==========================================
// 8. SETTINGS ROUTES
// ==========================================

// Public branding & system info endpoint (unauthenticated for login view & app branding)
apiRouter.get('/settings/public', (_req: Request, res: Response) => {
  try {
    const company = queryOne('SELECT company_name, logo_url, address, phone, email, website FROM company_settings WHERE id = 1');
    const invoice = queryOne('SELECT app_name, primary_color, secondary_color, header_image_url, footer_image_url, public_app_url FROM invoice_settings WHERE id = 1');
    return res.json({
      success: true,
      data: {
        company_name: company?.company_name || 'Info Papandayan',
        app_name: invoice?.app_name || 'Info Papandayan - Invoice & Logistik',
        logo_url: company?.logo_url || '/invoice-header.svg',
        header_image_url: invoice?.header_image_url || '/invoice-header.svg',
        footer_image_url: invoice?.footer_image_url || '/invoice-footer.svg',
        primary_color: invoice?.primary_color || '#136239',
        secondary_color: invoice?.secondary_color || '#7ba892',
        public_app_url: invoice?.public_app_url || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pengaturan publik: ' + err.message });
  }
});

apiRouter.get('/settings/company', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const company = queryOne('SELECT * FROM company_settings WHERE id = 1');
    return res.json({ success: true, data: company });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pengaturan perusahaan: ' + err.message });
  }
});

apiRouter.put('/settings/company', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { company_name, logo_url, address, phone, email, website, bank_account_no, bank_name, bank_account_name } = req.body;

    if (!company_name) {
      return res.status(400).json({ success: false, message: 'Nama perusahaan wajib diisi' });
    }

    runQuery(
      `UPDATE company_settings
       SET company_name = ?, logo_url = ?, address = ?, phone = ?, email = ?, website = ?,
           bank_account_no = ?, bank_name = ?, bank_account_name = ?, updated_at = datetime('now', 'localtime')
       WHERE id = 1`,
      [
        company_name.trim(),
        logo_url || '',
        address?.trim() || '',
        phone?.trim() || '',
        email?.trim() || '',
        website?.trim() || '',
        bank_account_no?.trim() || '',
        bank_name?.trim() || '',
        bank_account_name?.trim() || '',
      ]
    );

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Mengubah Pengaturan',
      `Memperbarui profil informasi perusahaan: ${company_name.trim()}`,
      req.ip
    );

    return res.json({ success: true, message: 'Informasi perusahaan berhasil diperbarui' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan perusahaan: ' + err.message });
  }
});

apiRouter.get('/settings/invoice', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = queryOne<any>('SELECT * FROM invoice_settings WHERE id = 1');
    let paymentMethods = DEFAULT_PAYMENT_METHODS;
    if (settings?.payment_methods) {
      try {
        paymentMethods = JSON.parse(settings.payment_methods);
      } catch {
        paymentMethods = DEFAULT_PAYMENT_METHODS;
      }
    }

    return res.json({
      success: true,
      data: {
        ...settings,
        whatsapp_template: settings?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE,
        payment_methods: paymentMethods,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pengaturan invoice: ' + err.message });
  }
});

apiRouter.put('/settings/invoice', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      prefix,
      number_format,
      start_number,
      date_format,
      currency,
      default_tax_percent,
      default_discount,
      default_notes,
      signature_text,
      signer_name,
      signer_title,
      footer_text,
      primary_color,
      secondary_color,
      app_name,
      header_image_url,
      footer_image_url,
      whatsapp_template,
      payment_methods,
      public_app_url,
    } = req.body;

    const isSuperAdmin = req.user?.role_name === 'Super Admin' || req.user?.role_id === 1;

    // Retrieve current settings
    const currentSettings = queryOne<any>('SELECT * FROM invoice_settings WHERE id = 1');
    let finalHeaderImage = currentSettings?.header_image_url || '/invoice-header.svg';
    let finalFooterImage = currentSettings?.footer_image_url || '/invoice-footer.svg';

    if (header_image_url !== undefined) finalHeaderImage = header_image_url;
    if (footer_image_url !== undefined) finalFooterImage = footer_image_url;

    const finalWhatsAppTemplate =
      whatsapp_template !== undefined
        ? whatsapp_template
        : currentSettings?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE;

    let finalPaymentMethods = currentSettings?.payment_methods || JSON.stringify(DEFAULT_PAYMENT_METHODS);
    if (payment_methods !== undefined) {
      finalPaymentMethods =
        typeof payment_methods === 'string' ? payment_methods : JSON.stringify(payment_methods);
    }

    const finalPublicAppUrl =
      public_app_url !== undefined
        ? (public_app_url || '').trim().replace(/\/+$/, '')
        : (currentSettings?.public_app_url || '');

    runQuery(
      `UPDATE invoice_settings
       SET prefix = ?, number_format = ?, start_number = ?, date_format = ?, currency = ?,
           default_tax_percent = ?, default_discount = ?, default_notes = ?,
           signature_text = ?, signer_name = ?, signer_title = ?, footer_text = ?,
           primary_color = ?, secondary_color = ?, app_name = ?,
           header_image_url = ?, footer_image_url = ?,
           whatsapp_template = ?, payment_methods = ?,
           public_app_url = ?,
           updated_at = datetime('now', 'localtime')
       WHERE id = 1`,
      [
        prefix?.trim() || 'INV',
        number_format?.trim() || 'INV/{YYYY}/{MM}/{NUMBER}',
        parseInt(start_number) || 1,
        date_format || 'DD/MM/YYYY',
        currency || 'IDR',
        parseFloat(default_tax_percent) || 0,
        parseFloat(default_discount) || 0,
        default_notes || '',
        signature_text || 'Hormat Kami,',
        signer_name || 'Mohamad Rizal',
        signer_title || 'Direktur Operasional Info Papandayan',
        footer_text || '',
        primary_color || '#136239',
        secondary_color || '#7ba892',
        app_name || 'Info Papandayan - Invoice & Logistik',
        finalHeaderImage,
        finalFooterImage,
        finalWhatsAppTemplate,
        finalPaymentMethods,
        finalPublicAppUrl,
      ]
    );

    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Mengubah Pengaturan',
      `Memperbarui konfigurasi invoice, template pesan WhatsApp, metode pembayaran, serta kop & footer dokumen`,
      req.ip
    );

    let parsedMethods = DEFAULT_PAYMENT_METHODS;
    try {
      parsedMethods = JSON.parse(finalPaymentMethods);
    } catch {}

    return res.json({
      success: true,
      message: 'Pengaturan invoice, template WhatsApp, dan metode pembayaran berhasil disimpan',
      data: {
        header_image_url: finalHeaderImage,
        footer_image_url: finalFooterImage,
        whatsapp_template: finalWhatsAppTemplate,
        payment_methods: parsedMethods,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan invoice: ' + err.message });
  }
});

// Update payment methods specifically
apiRouter.put('/settings/payment-methods', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { payment_methods } = req.body;
    if (!Array.isArray(payment_methods) || payment_methods.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal harus ada 1 metode pembayaran terdaftar' });
    }
    const jsonStr = JSON.stringify(payment_methods);
    runQuery(
      `UPDATE invoice_settings 
       SET payment_methods = ?, updated_at = datetime('now', 'localtime') 
       WHERE id = 1`,
      [jsonStr]
    );
    saveDb();

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Mengubah Metode Pembayaran',
      `Memperbarui ${payment_methods.length} daftar rekening & metode pembayaran invoice`,
      req.ip
    );

    return res.json({
      success: true,
      message: 'Daftar metode pembayaran berhasil diperbarui!',
      data: payment_methods,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan metode pembayaran: ' + err.message });
  }
});

// Upload header / footer banner image (PNG, JPG, SVG, WebP)
apiRouter.post('/settings/upload-banner', requireAuth, upload.single('file') as any, (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file gambar yang diunggah' });
    }

    const mime = file.mimetype || 'image/png';
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    return res.json({
      success: true,
      url: dataUrl,
      message: 'Banner berhasil diunggah dan siap digunakan',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengunggah banner: ' + err.message });
  }
});

// ==========================================
// 9. USER & ROLE MANAGEMENT ROUTES
// ==========================================

apiRouter.get('/users', requireAuth, requireSuperAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = queryAll(`
      SELECT u.id, u.username, u.email, u.full_name, u.role_id, u.is_active, u.created_at, u.updated_at,
             r.name as role_name, r.description as role_description
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id ASC
    `);
    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pengguna: ' + err.message });
  }
});

apiRouter.get('/roles', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = queryAll('SELECT * FROM roles ORDER BY id ASC');
    return res.json({ success: true, data: roles });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar role: ' + err.message });
  }
});

apiRouter.post('/users', requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password, full_name, role_id = 2, is_active = 1 } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, email, nama lengkap, dan password wajib diisi' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
    }

    const dupUser = queryOne('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [
      username.trim(),
      email.trim(),
    ]);
    if (dupUser) {
      return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan oleh pengguna lain' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const result = runQuery(
      `INSERT INTO users (username, email, password_hash, role_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
      [username.trim(), email.trim(), passwordHash, role_id, full_name.trim(), is_active ? 1 : 0]
    );

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Tambah User',
      `Membuat pengguna baru: ${username.trim()} (${full_name.trim()})`,
      req.ip
    );

    return res.status(201).json({
      success: true,
      message: 'Pengguna baru berhasil didaftarkan',
      userId: result.lastInsertRowId,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal membuat pengguna: ' + err.message });
  }
});

apiRouter.put('/users/:id', requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, role_id, is_active, password } = req.body;

    const existing = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    if (!username || !email || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, email, dan nama lengkap wajib diisi' });
    }

    const dupUser = queryOne('SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?', [
      username.trim(),
      email.trim(),
      id,
    ]);
    if (dupUser) {
      return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan oleh pengguna lain' });
    }

    if (password && password.trim().length > 0) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
      }
      const newHash = bcrypt.hashSync(password, 10);
      runQuery(
        `UPDATE users
         SET username = ?, email = ?, full_name = ?, role_id = ?, is_active = ?, password_hash = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [username.trim(), email.trim(), full_name.trim(), role_id || existing.role_id, is_active ? 1 : 0, newHash, id]
      );
    } else {
      runQuery(
        `UPDATE users
         SET username = ?, email = ?, full_name = ?, role_id = ?, is_active = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [username.trim(), email.trim(), full_name.trim(), role_id || existing.role_id, is_active ? 1 : 0, id]
      );
    }

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Edit User',
      `Mengubah data pengguna ID ${id} (${username.trim()})`,
      req.ip
    );

    return res.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengguna: ' + err.message });
  }
});

apiRouter.delete('/users/:id', requireAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user?.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri' });
    }

    const existing = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    runQuery('DELETE FROM users WHERE id = ?', [id]);

    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Hapus User',
      `Menghapus akun pengguna ${existing.username} (${existing.full_name})`,
      req.ip
    );

    return res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengguna: ' + err.message });
  }
});

// ==========================================
// 10. ACTIVITY LOGS ROUTES
// ==========================================

apiRouter.get('/activity-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', search, action } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push('(username LIKE ? OR action LIKE ? OR details LIKE ?)');
      const s = `%${(search as string).trim()}%`;
      params.push(s, s, s);
    }

    if (action && action !== 'all') {
      whereClauses.push('action = ?');
      params.push(action);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = queryOne<{ total: number }>(`SELECT COUNT(*) as total FROM activity_logs ${whereSql}`, params);
    const total = countRow?.total || 0;

    const logs = queryAll(
      `SELECT * FROM activity_logs
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat log aktivitas: ' + err.message });
  }
});

// Delete single activity log
apiRouter.delete('/activity-logs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = queryOne('SELECT * FROM activity_logs WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Log aktivitas tidak ditemukan' });
    }

    runQuery('DELETE FROM activity_logs WHERE id = ?', [id]);
    saveDb();

    return res.json({ success: true, message: 'Log aktivitas berhasil dihapus' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus log aktivitas: ' + err.message });
  }
});

// Clear all activity logs
apiRouter.delete('/activity-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    runQuery('DELETE FROM activity_logs');
    saveDb();

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    logActivity(
      req.user?.id || null,
      req.user?.username || 'admin',
      'Bersihkan Log',
      `Riwayat seluruh log aktivitas telah dibersihkan oleh ${req.user?.full_name || 'Admin'}`,
      ip
    );

    return res.json({ success: true, message: 'Seluruh riwayat log aktivitas berhasil dibersihkan' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal membersihkan log aktivitas: ' + err.message });
  }
});
