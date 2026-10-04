import * as XLSX from 'xlsx';

function s2ab(s: string): ArrayBuffer {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xff;
  }
  return buf;
}

function triggerDownload(workbook: XLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
  const blob = new Blob([s2ab(wbout)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

// 1. Download Product Import Template
export function downloadProductImportTemplate() {
  const templateRows = [
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
    {
      'Kode Produk': 'PRD-106',
      'Nama Produk': 'Sleeping Bag Polar Tebal Hangat',
      'Kategori': 'Peralatan Outdoor',
      'Satuan': 'Pcs',
      'Harga': 30000,
      'Stok': 60,
      'Keterangan': 'Sleeping bag polar nyaman untuk suhu dingin pegunungan',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateRows);

  // Set explicit column widths for readability
  worksheet['!cols'] = [
    { wch: 15 }, // Kode Produk
    { wch: 38 }, // Nama Produk
    { wch: 22 }, // Kategori
    { wch: 12 }, // Satuan
    { wch: 14 }, // Harga
    { wch: 10 }, // Stok
    { wch: 55 }, // Keterangan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Produk');

  triggerDownload(workbook, 'Template-Import-Produk-InfoPapandayan.xlsx');
}

// 2. Download Monthly Report Excel (Laporan Excel Per Bulan)
export interface MonthlyReportPayload {
  yearMonth: string; // e.g. "2026-10"
  items: Array<{
    tanggal: string;
    nomor_invoice: string;
    nama_pelanggan: string;
    kode_produk: string;
    nama_barang: string;
    kategori?: string;
    jumlah: number;
    satuan: string;
    harga: number;
    total_nilai: number;
  }>;
  summary: {
    total_transaksi: number;
    total_jenis_barang: number;
    total_qty_keluar: number;
    total_nilai_keluar: number;
  };
}

export function downloadMonthlyReportExcel({ yearMonth, items, summary }: MonthlyReportPayload) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Bulanan
  const monthName = formatYearMonthIndo(yearMonth);
  const summarySheetData = [
    ['LAPORAN REKAPITULASI BARANG KELUAR & TRANSAKSI BULANAN'],
    ['INFO PAPANDAYAN - SISTEM INVOICE & LOGISTIK RESMI'],
    [''],
    ['Periode Bulan', monthName],
    ['Kode Periode', yearMonth],
    ['Tanggal Dibuat', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
    [''],
    ['RINGKASAN UTAMA', 'NILAI / JUMLAH'],
    ['Total Transaksi Invoice', summary.total_transaksi],
    ['Total Variasi Barang Keluar', summary.total_jenis_barang],
    ['Total Kuantitas Barang Keluar', summary.total_qty_keluar],
    ['Total Nilai Pengeluaran / Omzet (Rp)', summary.total_nilai_keluar],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan Bulanan');

  // Sheet 2: Rincian Lengkap Barang Keluar
  const detailRows = items.map((it, idx) => ({
    'No': idx + 1,
    'Tanggal': it.tanggal,
    'Nomor Invoice': it.nomor_invoice,
    'Nama Pelanggan': it.nama_pelanggan,
    'Kode Produk': it.kode_produk,
    'Nama Barang / Layanan': it.nama_barang,
    'Kategori': it.kategori || '-',
    'Qty Keluar': it.jumlah,
    'Satuan': it.satuan,
    'Harga Satuan (Rp)': it.harga,
    'Total Nilai (Rp)': it.total_nilai,
  }));

  const wsDetails = XLSX.utils.json_to_sheet(
    detailRows.length > 0
      ? detailRows
      : [
          {
            'No': '-',
            'Tanggal': '-',
            'Nomor Invoice': '-',
            'Nama Pelanggan': '-',
            'Kode Produk': '-',
            'Nama Barang / Layanan': 'Belum ada transaksi di bulan ini',
            'Kategori': '-',
            'Qty Keluar': 0,
            'Satuan': '-',
            'Harga Satuan (Rp)': 0,
            'Total Nilai (Rp)': 0,
          },
        ]
  );

  wsDetails['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 22 },
    { wch: 28 },
    { wch: 14 },
    { wch: 35 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsDetails, 'Rincian Barang Keluar');

  // Sheet 3: Rekap Agregat per Produk di Bulan Tersebut
  const productAggMap = new Map<string, { code: string; name: string; category: string; totalQty: number; totalAmount: number }>();
  for (const it of items) {
    const key = it.kode_produk || it.nama_barang;
    const existing = productAggMap.get(key) || {
      code: it.kode_produk,
      name: it.nama_barang,
      category: it.kategori || '-',
      totalQty: 0,
      totalAmount: 0,
    };
    existing.totalQty += it.jumlah;
    existing.totalAmount += it.total_nilai;
    productAggMap.set(key, existing);
  }

  const productAggRows = Array.from(productAggMap.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .map((p, idx) => ({
      'Peringkat': idx + 1,
      'Kode Produk': p.code,
      'Nama Barang / Layanan': p.name,
      'Kategori': p.category,
      'Total Qty Terjual / Keluar': p.totalQty,
      'Total Nilai Penjualan (Rp)': p.totalAmount,
    }));

  const wsProducts = XLSX.utils.json_to_sheet(
    productAggRows.length > 0
      ? productAggRows
      : [{ 'Peringkat': '-', 'Kode Produk': '-', 'Nama Barang / Layanan': '-', 'Kategori': '-', 'Total Qty Terjual / Keluar': 0, 'Total Nilai Penjualan (Rp)': 0 }]
  );

  wsProducts['!cols'] = [
    { wch: 10 },
    { wch: 15 },
    { wch: 35 },
    { wch: 20 },
    { wch: 25 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsProducts, 'Rekapitulasi Produk');

  triggerDownload(workbook, `Laporan-Barang-Keluar-Bulan-${yearMonth}.xlsx`);
}

// 3. Export Products List to Excel
export function exportProductsListExcel(products: any[]) {
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
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 35 },
    { wch: 20 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Produk');

  const today = new Date().toISOString().split('T')[0];
  triggerDownload(workbook, `Daftar-Produk-${today}.xlsx`);
}

// 4. Export Customers to Excel
export function exportCustomersListExcel(customers: any[]) {
  const exportData = customers.map((c, idx) => ({
    No: idx + 1,
    'Nama Pelanggan': c.name,
    Alamat: c.address || '-',
    'No Telepon': c.phone || '-',
    Email: c.email || '-',
    'Total Transaksi Invoice': c.invoice_count || 0,
    'Total Nilai Pembelian (Rp)': c.total_spent || 0,
    Catatan: c.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 38 },
    { wch: 16 },
    { wch: 24 },
    { wch: 22 },
    { wch: 24 },
    { wch: 35 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pelanggan');

  const today = new Date().toISOString().split('T')[0];
  triggerDownload(workbook, `Daftar-Pelanggan-${today}.xlsx`);
}

// 5. Export Invoices to Excel
export function exportInvoicesListExcel(invoices: any[]) {
  const exportData = invoices.map((inv, idx) => ({
    No: idx + 1,
    'Nomor Invoice': inv.invoice_number,
    'Nama Klien / Penerima': inv.customer_name,
    'Tanggal Kegiatan': inv.activity_date,
    'Jumlah Jenis Barang': inv.item_count || 0,
    'Subtotal (Rp)': inv.subtotal || 0,
    'Diskon (Rp)': inv.discount_amount || 0,
    'PPN (Rp)': inv.tax_amount || 0,
    'Total Nilai (Rp)': inv.total_amount || 0,
    Status: inv.status === 'paid' ? 'Lunas' : inv.status === 'pending' ? 'Menunggu' : inv.status === 'cancelled' ? 'Dibatalkan' : 'Draft',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 28 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Invoice');

  const today = new Date().toISOString().split('T')[0];
  triggerDownload(workbook, `Daftar-Invoice-${today}.xlsx`);
}

// 6. Resilient Client-Side Parser for Product Import Excel
export interface ProductImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  categoryId: number | null;
  unit: string;
  price: number;
  stock: number;
  description: string;
  isUpdate: boolean;
  isValid: boolean;
  error: string;
}

export function parseProductImportExcel(
  buffer: ArrayBuffer,
  existingCodes: string[] = [],
  categories: Array<{ id: number; name: string }> = []
): {
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: ProductImportPreviewRow[];
} {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('File Excel kosong atau tidak memiliki baris data.');
  }

  const existingCodesSet = new Set(existingCodes.map((c) => c.toLowerCase().trim()));
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));

  const previewRows: ProductImportPreviewRow[] = [];
  let validCount = 0;
  let errorCount = 0;
  const seenCodesInFile = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for 0-index, +1 for header row

    // Normalize keys
    const normMap = new Map<string, any>();
    for (const k of Object.keys(row)) {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      normMap.set(cleanKey, row[k]);
    }

    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normMap.has(cleanK)) {
          return String(normMap.get(cleanK)).trim();
        }
      }
      return '';
    };

    const code = getVal('Kode Produk', 'Kode', 'kode_produk', 'code', 'product_code');
    const name = getVal('Nama Produk', 'Nama Barang', 'Nama', 'nama_produk', 'name', 'product_name');
    const category = getVal('Kategori', 'category', 'kategori_produk');
    const unit = getVal('Satuan', 'unit', 'satuan_produk') || 'Pcs';
    const description = getVal('Keterangan', 'Deskripsi', 'description', 'notes', 'catatan');

    // Parse price with tolerance for Rp, dots, commas
    const rawPrice = getVal('Harga', 'harga', 'price', 'harga_satuan', 'hargarp');
    let price = 0;
    if (rawPrice) {
      const cleanP = rawPrice.replace(/Rp|IDR|\s/gi, '');
      if (cleanP.includes('.') && !cleanP.includes(',')) {
        const parts = cleanP.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
          price = parseFloat(cleanP.replace(/\./g, '')) || 0;
        } else {
          price = parseFloat(cleanP) || 0;
        }
      } else if (cleanP.includes(',')) {
        price = parseFloat(cleanP.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        price = parseFloat(cleanP.replace(/[^0-9.-]/g, '')) || 0;
      }
    }

    // Parse stock
    const rawStock = getVal('Stok', 'stok', 'stock', 'stok_saat_ini', 'qty');
    let stock = 0;
    if (rawStock) {
      stock = parseInt(rawStock.replace(/[^0-9-]/g, ''), 10) || 0;
    }

    const errors: string[] = [];

    if (!code) {
      errors.push('Kode produk wajib diisi');
    } else {
      const lowerCode = code.toLowerCase();
      if (seenCodesInFile.has(lowerCode)) {
        errors.push(`Kode '${code}' duplikat di dalam file Excel`);
      } else {
        seenCodesInFile.add(lowerCode);
      }
    }

    if (!name) {
      errors.push('Nama produk wajib diisi');
    }

    if (isNaN(price) || price < 0) {
      errors.push('Harga harus berupa angka non-negatif');
    }

    if (isNaN(stock) || stock < 0) {
      errors.push('Stok harus berupa angka bulat non-negatif');
    }

    const isUpdate = code ? existingCodesSet.has(code.toLowerCase()) : false;
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
      categoryId: category ? categoryMap.get(category.toLowerCase()) || null : null,
      unit,
      price: isNaN(price) ? 0 : price,
      stock: isNaN(stock) ? 0 : stock,
      description,
      isUpdate,
      isValid,
      error: errors.join('; '),
    });
  });

  return {
    totalRows: rawRows.length,
    validCount,
    errorCount,
    rows: previewRows,
  };
}

function formatYearMonthIndo(ym: string): string {
  if (!ym) return '';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const name = months[monthNum - 1] || parts[1];
  return `${name} ${year}`;
}
