import * as XLSX from 'xlsx';

function triggerDownload(workbook: XLSX.WorkBook, filename: string) {
  try {
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 400);
  } catch (err) {
    console.error('Trigger download error, falling back to XLSX.writeFile:', err);
    try {
      XLSX.writeFile(workbook, filename);
    } catch (e2) {
      console.error('Fatal XLSX export error:', e2);
    }
  }
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
  const monthName = formatYearMonthIndo(yearMonth);

  // Sheet 1: Rincian Lengkap Barang yang Dipesan oleh Pelanggan (Ke Bawah)
  const detailRows = items.map((it, idx) => ({
    'No': idx + 1,
    'Tanggal Transaksi': it.tanggal || '-',
    'Nomor Invoice': it.nomor_invoice || '-',
    'Nama Pelanggan': it.nama_pelanggan || '-',
    'Kode Produk': it.kode_produk || '-',
    'Nama Barang yang Dipesan': it.nama_barang || '-',
    'Kategori': it.kategori || '-',
    'Jumlah (Qty)': it.jumlah || 0,
    'Satuan': it.satuan || 'Pcs',
    'Harga Satuan (Rp)': it.harga || 0,
    'Total Nilai (Rp)': it.total_nilai || 0,
  }));

  const wsDetails = XLSX.utils.json_to_sheet(
    detailRows.length > 0
      ? detailRows
      : [
          {
            'No': '-',
            'Tanggal Transaksi': '-',
            'Nomor Invoice': '-',
            'Nama Pelanggan': '-',
            'Kode Produk': '-',
            'Nama Barang yang Dipesan': 'Belum ada transaksi pada periode ini',
            'Kategori': '-',
            'Jumlah (Qty)': 0,
            'Satuan': '-',
            'Harga Satuan (Rp)': 0,
            'Total Nilai (Rp)': 0,
          },
        ]
  );

  wsDetails['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 24 },
    { wch: 30 },
    { wch: 15 },
    { wch: 40 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsDetails, 'Rincian Barang (Ke Bawah)');

  // Sheet 2: Format Faktur & Rincian Barang ke Bawah (Visual / Hierarki Faktur)
  const invoicesMap = new Map<string, {
    invoiceNumber: string;
    date: string;
    customer: string;
    items: typeof items;
    totalAmount: number;
    totalQty: number;
  }>();

  for (const it of items) {
    const invKey = it.nomor_invoice || 'INV-LAIN';
    const existing = invoicesMap.get(invKey) || {
      invoiceNumber: it.nomor_invoice || '-',
      date: it.tanggal || '-',
      customer: it.nama_pelanggan || '-',
      items: [],
      totalAmount: 0,
      totalQty: 0,
    };
    existing.items.push(it);
    existing.totalAmount += it.total_nilai || 0;
    existing.totalQty += it.jumlah || 0;
    invoicesMap.set(invKey, existing);
  }

  const groupedAoa: any[][] = [
    ['LAPORAN REKAPITULASI BARANG KELUAR PER FAKTUR & PELANGGAN'],
    ['Periode:', monthName || yearMonth, 'Tanggal Unduh:', new Date().toLocaleDateString('id-ID')],
    [''],
  ];

  let grpIdx = 1;
  for (const inv of invoicesMap.values()) {
    groupedAoa.push([
      `#${grpIdx++}`,
      `NO. INVOICE: ${inv.invoiceNumber}`,
      `TANGGAL: ${inv.date}`,
      `PELANGGAN: ${inv.customer}`,
      `TOTAL ITEM: ${inv.items.length}`,
      `TOTAL QTY: ${inv.totalQty}`,
      `TOTAL NILAI: Rp ${inv.totalAmount.toLocaleString('id-ID')}`,
    ]);
    groupedAoa.push([
      '',
      'No. Item',
      'Kode Produk',
      'Nama Barang yang Dipesan',
      'Jumlah (Qty)',
      'Satuan',
      'Harga Satuan (Rp)',
      'Total Nilai (Rp)',
    ]);

    inv.items.forEach((it, iIdx) => {
      groupedAoa.push([
        '',
        iIdx + 1,
        it.kode_produk || '-',
        it.nama_barang,
        it.jumlah,
        it.satuan || 'Pcs',
        it.harga,
        it.total_nilai,
      ]);
    });

    groupedAoa.push([
      '',
      '',
      '',
      `Subtotal Faktur ${inv.invoiceNumber}:`,
      inv.totalQty,
      'Unit',
      '',
      inv.totalAmount,
    ]);
    groupedAoa.push(['']); // Blank separator
  }

  const wsGrouped = XLSX.utils.aoa_to_sheet(groupedAoa);
  wsGrouped['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 18 },
    { wch: 38 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsGrouped, 'Faktur & Barang (Ke Bawah)');

  // Sheet 3: Rekap Barang Paling Sering Keluar (Top Outgoing Products)
  const productAggMap = new Map<
    string,
    {
      code: string;
      name: string;
      category: string;
      unit: string;
      totalQty: number;
      orderCount: number;
      totalAmount: number;
      customers: Set<string>;
    }
  >();

  for (const it of items) {
    const key = (it.kode_produk || it.nama_barang || '').trim();
    if (!key) continue;
    const existing = productAggMap.get(key) || {
      code: it.kode_produk || '-',
      name: it.nama_barang || 'Barang',
      category: it.kategori || '-',
      unit: it.satuan || 'Pcs',
      totalQty: 0,
      orderCount: 0,
      totalAmount: 0,
      customers: new Set<string>(),
    };
    existing.totalQty += it.jumlah || 0;
    existing.orderCount += 1;
    existing.totalAmount += it.total_nilai || 0;
    if (it.nama_pelanggan) {
      existing.customers.add(it.nama_pelanggan.trim());
    }
    productAggMap.set(key, existing);
  }

  const productAggRows = Array.from(productAggMap.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .map((p, idx) => ({
      'Peringkat': idx + 1,
      'Nama Barang': p.name,
      'Kode Produk': p.code,
      'Kategori': p.category,
      'Total Qty Dipesan / Keluar': p.totalQty,
      'Satuan': p.unit,
      'Frekuensi Pemesanan': `${p.orderCount} kali transaksi`,
      'Total Nilai Penjualan (Rp)': p.totalAmount,
      'Daftar Pelanggan Pemesan': Array.from(p.customers).slice(0, 8).join(', ') + (p.customers.size > 8 ? ` (+${p.customers.size - 8} lainnya)` : ''),
    }));

  const wsProducts = XLSX.utils.json_to_sheet(
    productAggRows.length > 0
      ? productAggRows
      : [
          {
            'Peringkat': '-',
            'Nama Barang': '-',
            'Kode Produk': '-',
            'Kategori': '-',
            'Total Qty Dipesan / Keluar': 0,
            'Satuan': '-',
            'Frekuensi Pemesanan': '-',
            'Total Nilai Penjualan (Rp)': 0,
            'Daftar Pelanggan Pemesan': '-',
          },
        ]
  );

  wsProducts['!cols'] = [
    { wch: 10 },
    { wch: 38 },
    { wch: 15 },
    { wch: 20 },
    { wch: 26 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsProducts, 'Barang Sering Keluar');

  // Sheet 4: Rekap Pesanan Per Pelanggan (Barang Ke Bawah dengan Garis Baru)
  const customerAggMap = new Map<
    string,
    {
      customerName: string;
      itemsList: Map<string, { qty: number; unit: string }>;
      totalInvoices: Set<string>;
      totalQty: number;
      totalSpent: number;
    }
  >();

  for (const it of items) {
    const custName = (it.nama_pelanggan || 'Pelanggan Umum').trim();
    const existing = customerAggMap.get(custName) || {
      customerName: custName,
      itemsList: new Map(),
      totalInvoices: new Set(),
      totalQty: 0,
      totalSpent: 0,
    };

    if (it.nomor_invoice) existing.totalInvoices.add(it.nomor_invoice);
    existing.totalQty += it.jumlah || 0;
    existing.totalSpent += it.total_nilai || 0;

    const prodKey = it.nama_barang || 'Barang';
    const prodExisting = existing.itemsList.get(prodKey) || { qty: 0, unit: it.satuan || 'Pcs' };
    prodExisting.qty += it.jumlah || 0;
    existing.itemsList.set(prodKey, prodExisting);

    customerAggMap.set(custName, existing);
  }

  const customerAggRows = Array.from(customerAggMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .map((c, idx) => {
      const formattedItems = Array.from(c.itemsList.entries())
        .map(([name, data], i) => `${i + 1}. ${name} (${data.qty} ${data.unit})`)
        .join('\r\n');

      return {
        'No': idx + 1,
        'Nama Pelanggan': c.customerName,
        'Daftar Barang & Jumlah Dipesan (Ke Bawah)': formattedItems,
        'Jumlah Jenis Barang': c.itemsList.size,
        'Total Kuantitas (Qty)': c.totalQty,
        'Total Transaksi Invoice': c.totalInvoices.size,
        'Total Nilai Belanja (Rp)': c.totalSpent,
      };
    });

  const wsCustomers = XLSX.utils.json_to_sheet(
    customerAggRows.length > 0
      ? customerAggRows
      : [
          {
            'No': '-',
            'Nama Pelanggan': '-',
            'Daftar Barang & Jumlah Dipesan (Ke Bawah)': '-',
            'Jumlah Jenis Barang': 0,
            'Total Kuantitas (Qty)': 0,
            'Total Transaksi Invoice': 0,
            'Total Nilai Belanja (Rp)': 0,
          },
        ]
  );

  wsCustomers['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 55 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsCustomers, 'Rekap Pesanan Per Pelanggan');

  // Sheet 5: Ringkasan Bulanan
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

  const safePeriod = (yearMonth || 'Periode').replace(/[^a-zA-Z0-9_-]/g, '-');
  triggerDownload(workbook, `Laporan-Barang-Keluar-${safePeriod}.xlsx`);
}

// 3. Export Products List to Excel
export function exportProductsListExcel(products: any[]) {
  if (!products || products.length === 0) {
    throw new Error('Tidak ada data produk yang dapat diekspor');
  }

  const exportData = products.map((p, idx) => {
    const rawPrice = typeof p.price === 'number' ? p.price : parseFloat(String(p.price).replace(/[^0-9.-]/g, '')) || 0;
    const rawStock = typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock).replace(/[^0-9-]/g, ''), 10) || 0;

    return {
      No: idx + 1,
      'Kode Produk': String(p.code || '').trim(),
      'Nama Produk': String(p.name || '').trim(),
      Kategori: p.category_name || p.category || '-',
      Satuan: p.unit || 'Pcs',
      'Harga Jual (Rp)': rawPrice,
      'Stok Saat Ini': rawStock,
      Status: p.status === 'active' ? 'Aktif' : 'Nonaktif',
      Keterangan: p.description || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 16 }, // Kode Produk
    { wch: 40 }, // Nama Produk
    { wch: 22 }, // Kategori
    { wch: 12 }, // Satuan
    { wch: 18 }, // Harga Jual (Rp)
    { wch: 14 }, // Stok Saat Ini
    { wch: 14 }, // Status
    { wch: 50 }, // Keterangan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Katalog Produk');

  const today = new Date().toISOString().split('T')[0];
  triggerDownload(workbook, `Katalog-Produk-${today}.xlsx`);
}

// 3b. Export Products List to CSV (with UTF-8 BOM for perfect Excel/Spreadsheet compatibility)
export function exportProductsListCSV(products: any[]) {
  if (!products || products.length === 0) {
    throw new Error('Tidak ada data produk yang dapat diekspor');
  }

  const exportData = products.map((p, idx) => {
    const rawPrice = typeof p.price === 'number' ? p.price : parseFloat(String(p.price).replace(/[^0-9.-]/g, '')) || 0;
    const rawStock = typeof p.stock === 'number' ? p.stock : parseInt(String(p.stock).replace(/[^0-9-]/g, ''), 10) || 0;

    return {
      No: idx + 1,
      'Kode Produk': String(p.code || '').trim(),
      'Nama Produk': String(p.name || '').trim(),
      Kategori: p.category_name || p.category || '-',
      Satuan: p.unit || 'Pcs',
      'Harga Jual (Rp)': rawPrice,
      'Stok Saat Ini': rawStock,
      Status: p.status === 'active' ? 'Aktif' : 'Nonaktif',
      Keterangan: p.description || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const csvText = XLSX.utils.sheet_to_csv(worksheet);

  // Prefix with UTF-8 BOM (\uFEFF) so Excel and third-party apps recognize all UTF-8 characters
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Katalog-Produk-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
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

// 5. Export Invoices to Excel with Customer Ordered Items and Top Outgoing Products
export function exportInvoicesListExcel(invoices: any[]) {
  if (!invoices || invoices.length === 0) {
    throw new Error('Tidak ada data invoice untuk diekspor');
  }

  const workbook = XLSX.utils.book_new();

  // Extract all individual items from invoices for downward list
  const allOrderedItems: Array<{
    no: number;
    tanggal: string;
    nomor_invoice: string;
    nama_pelanggan: string;
    item_index: number;
    kode_produk: string;
    nama_barang: string;
    qty: number;
    unit: string;
    price: number;
    subtotal: number;
    total_invoice: number;
    status: string;
  }> = [];

  let rowCounter = 1;

  for (const inv of invoices) {
    const rawItems = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [];
    const statusText = inv.status === 'paid' ? 'Lunas' : inv.status === 'pending' ? 'Menunggu' : inv.status === 'cancelled' ? 'Dibatalkan' : 'Draft';
    const invTotal = Number(inv.total_amount) || 0;

    if (rawItems.length > 0) {
      rawItems.forEach((it: any, itemIdx: number) => {
        allOrderedItems.push({
          no: rowCounter++,
          tanggal: inv.activity_date || '-',
          nomor_invoice: inv.invoice_number || `INV-${inv.id}`,
          nama_pelanggan: inv.customer_name || 'Pelanggan',
          item_index: itemIdx + 1,
          kode_produk: it.product_code || '-',
          nama_barang: it.product_name || 'Barang',
          qty: Number(it.qty) || 1,
          unit: it.unit || 'Pcs',
          price: Number(it.price) || 0,
          subtotal: Number(it.subtotal) || (Number(it.qty) || 1) * (Number(it.price) || 0),
          total_invoice: invTotal,
          status: statusText,
        });
      });
    } else if (inv.items_summary) {
      // If only items_summary is available
      const parsed = inv.items_summary.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (parsed.length > 0) {
        parsed.forEach((pStr: string, itemIdx: number) => {
          allOrderedItems.push({
            no: rowCounter++,
            tanggal: inv.activity_date || '-',
            nomor_invoice: inv.invoice_number || `INV-${inv.id}`,
            nama_pelanggan: inv.customer_name || 'Pelanggan',
            item_index: itemIdx + 1,
            kode_produk: '-',
            nama_barang: pStr,
            qty: 1,
            unit: 'Pcs',
            price: itemIdx === 0 ? invTotal : 0,
            subtotal: itemIdx === 0 ? invTotal : 0,
            total_invoice: invTotal,
            status: statusText,
          });
        });
      }
    }
  }

  // Sheet 1: Rincian Lengkap Barang Dipesan ke Bawah (Setiap Barang Baris Sendiri)
  const sheet1Rows = allOrderedItems.map((it) => ({
    'No': it.no,
    'Tanggal Transaksi': it.tanggal,
    'Nomor Invoice': it.nomor_invoice,
    'Nama Pelanggan': it.nama_pelanggan,
    'No. Item': it.item_index,
    'Kode Produk': it.kode_produk,
    'Nama Barang yang Dipesan': it.nama_barang,
    'Jumlah (Qty)': it.qty,
    'Satuan': it.unit,
    'Harga Satuan (Rp)': it.price,
    'Subtotal Barang (Rp)': it.subtotal,
    'Total Tagihan Invoice (Rp)': it.total_invoice,
    'Status Tagihan': it.status,
  }));

  const wsSheet1 = XLSX.utils.json_to_sheet(
    sheet1Rows.length > 0
      ? sheet1Rows
      : [
          {
            'No': '-',
            'Tanggal Transaksi': '-',
            'Nomor Invoice': '-',
            'Nama Pelanggan': '-',
            'No. Item': '-',
            'Kode Produk': '-',
            'Nama Barang yang Dipesan': 'Belum ada data barang',
            'Jumlah (Qty)': 0,
            'Satuan': '-',
            'Harga Satuan (Rp)': 0,
            'Subtotal Barang (Rp)': 0,
            'Total Tagihan Invoice (Rp)': 0,
            'Status Tagihan': '-',
          },
        ]
  );

  wsSheet1['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 22 },
    { wch: 28 },
    { wch: 10 },
    { wch: 15 },
    { wch: 40 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsSheet1, 'Rincian Barang (Ke Bawah)');

  // Sheet 2: Format Faktur & Barang ke Bawah (Tampilan Hierarki per Faktur)
  const groupedAoa: any[][] = [
    ['LAPORAN RINCIAN FAKTUR & DAFTAR BARANG YANG DIPESAN'],
    ['Info Papandayan - Sistem Logistik & Invoice'],
    ['Tanggal Cetak:', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
    [''],
  ];

  invoices.forEach((inv, invIdx) => {
    const rawItems = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [];
    const statusText = inv.status === 'paid' ? 'Lunas' : inv.status === 'pending' ? 'Menunggu' : inv.status === 'cancelled' ? 'Dibatalkan' : 'Draft';
    const totalAmount = Number(inv.total_amount) || 0;

    groupedAoa.push([
      `#${invIdx + 1}`,
      `FAKTUR: ${inv.invoice_number}`,
      `TANGGAL: ${inv.activity_date || '-'}`,
      `PELANGGAN: ${inv.customer_name || '-'}`,
      `STATUS: ${statusText}`,
      `TOTAL: Rp ${totalAmount.toLocaleString('id-ID')}`,
    ]);

    groupedAoa.push([
      '',
      'Item Ke',
      'Kode Produk',
      'Nama Barang yang Dipesan',
      'Jumlah (Qty)',
      'Satuan',
      'Harga Satuan (Rp)',
      'Subtotal (Rp)',
    ]);

    if (rawItems.length > 0) {
      rawItems.forEach((it: any, itIdx: number) => {
        groupedAoa.push([
          '',
          itIdx + 1,
          it.product_code || '-',
          it.product_name || 'Barang',
          Number(it.qty) || 1,
          it.unit || 'Pcs',
          Number(it.price) || 0,
          Number(it.subtotal) || (Number(it.qty) || 1) * (Number(it.price) || 0),
        ]);
      });
    } else if (inv.items_summary) {
      const parsed = inv.items_summary.split(',').map((s: string) => s.trim()).filter(Boolean);
      parsed.forEach((pStr: string, itIdx: number) => {
        groupedAoa.push([
          '',
          itIdx + 1,
          '-',
          pStr,
          1,
          'Pcs',
          itIdx === 0 ? totalAmount : 0,
          itIdx === 0 ? totalAmount : 0,
        ]);
      });
    } else {
      groupedAoa.push(['', 1, '-', 'Rincian produk terlampir', 1, 'Pcs', totalAmount, totalAmount]);
    }

    groupedAoa.push([
      '',
      '',
      '',
      `Subtotal Faktur ${inv.invoice_number}:`,
      inv.total_qty || rawItems.reduce((a: number, c: any) => a + (Number(c.qty) || 0), 0) || 1,
      'Unit',
      '',
      totalAmount,
    ]);
    groupedAoa.push(['']); // Blank separator
  });

  const wsGrouped = XLSX.utils.aoa_to_sheet(groupedAoa);
  wsGrouped['!cols'] = [
    { wch: 8 },
    { wch: 22 },
    { wch: 18 },
    { wch: 38 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsGrouped, 'Faktur & Barang (Ke Bawah)');

  // Sheet 3: Rekap Barang Paling Sering Keluar (Top Outgoing Products)
  const productAggMap = new Map<
    string,
    {
      name: string;
      code: string;
      unit: string;
      totalQty: number;
      orderCount: number;
      totalSales: number;
      customers: Set<string>;
    }
  >();

  for (const it of allOrderedItems) {
    const key = it.nama_barang.trim();
    if (!key) continue;
    const existing = productAggMap.get(key) || {
      name: it.nama_barang,
      code: it.kode_produk || '-',
      unit: it.unit || 'Pcs',
      totalQty: 0,
      orderCount: 0,
      totalSales: 0,
      customers: new Set<string>(),
    };
    existing.totalQty += it.qty || 0;
    existing.orderCount += 1;
    existing.totalSales += it.subtotal || 0;
    if (it.nama_pelanggan) existing.customers.add(it.nama_pelanggan.trim());
    productAggMap.set(key, existing);
  }

  const topProductsRows = Array.from(productAggMap.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .map((p, idx) => ({
      'Peringkat': idx + 1,
      'Nama Barang': p.name,
      'Kode Produk': p.code,
      'Total Qty Dipesan': p.totalQty,
      'Satuan': p.unit,
      'Frekuensi Pemesanan': `${p.orderCount} kali transaksi`,
      'Total Nilai Penjualan (Rp)': p.totalSales,
      'Daftar Pelanggan Pemesan': Array.from(p.customers).slice(0, 8).join(', ') + (p.customers.size > 8 ? ` (+${p.customers.size - 8} lainnya)` : ''),
    }));

  if (topProductsRows.length > 0) {
    const wsTop = XLSX.utils.json_to_sheet(topProductsRows);
    wsTop['!cols'] = [
      { wch: 10 },
      { wch: 38 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
      { wch: 45 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsTop, 'Barang Sering Keluar');
  }

  // Sheet 4: Rekap Seluruh Invoice (Rincian Barang ke Bawah dengan Garis Baru)
  const invoiceRows = invoices.map((inv, idx) => {
    let summaryOfItems = '';
    if (Array.isArray(inv.items) && inv.items.length > 0) {
      summaryOfItems = inv.items.map((it: any, i: number) => `${i + 1}. ${it.product_name} (${it.qty} ${it.unit || 'Pcs'})`).join('\r\n');
    } else if (inv.items_summary) {
      summaryOfItems = inv.items_summary.split(',').map((s: string, i: number) => `${i + 1}. ${s.trim()}`).join('\r\n');
    }

    return {
      'No': idx + 1,
      'Nomor Invoice': inv.invoice_number,
      'Tanggal Kegiatan': inv.activity_date,
      'Nama Pelanggan': inv.customer_name,
      'Barang yang Dipesan (Ke Bawah)': summaryOfItems || 'Rincian terlampir',
      'Total Qty Barang': inv.total_qty || (Array.isArray(inv.items) ? inv.items.reduce((a: number, c: any) => a + (Number(c.qty) || 0), 0) : 0),
      'Subtotal (Rp)': Number(inv.subtotal) || 0,
      'Diskon (Rp)': Number(inv.discount_amount) || 0,
      'PPN (Rp)': Number(inv.tax_amount) || 0,
      'Total Nilai Tagihan (Rp)': Number(inv.total_amount) || 0,
      'Status': inv.status === 'paid' ? 'Lunas' : inv.status === 'pending' ? 'Menunggu' : inv.status === 'cancelled' ? 'Dibatalkan' : 'Draft',
    };
  });

  const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows);
  wsInvoices['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 16 },
    { wch: 28 },
    { wch: 45 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsInvoices, 'Rekap Seluruh Invoice');

  // Sheet 5: Rekap Pesanan Per Pelanggan (Barang Ke Bawah)
  const customerAggMap = new Map<
    string,
    {
      customerName: string;
      itemsList: Map<string, { qty: number; unit: string }>;
      totalInvoices: Set<string>;
      totalQty: number;
      totalSpent: number;
    }
  >();

  for (const it of allOrderedItems) {
    const custName = (it.nama_pelanggan || 'Pelanggan Umum').trim();
    const existing = customerAggMap.get(custName) || {
      customerName: custName,
      itemsList: new Map(),
      totalInvoices: new Set(),
      totalQty: 0,
      totalSpent: 0,
    };

    if (it.nomor_invoice) existing.totalInvoices.add(it.nomor_invoice);
    existing.totalQty += it.qty || 0;
    existing.totalSpent += it.subtotal || 0;

    const prodKey = it.nama_barang || 'Barang';
    const prodExisting = existing.itemsList.get(prodKey) || { qty: 0, unit: it.unit || 'Pcs' };
    prodExisting.qty += it.qty || 0;
    existing.itemsList.set(prodKey, prodExisting);

    customerAggMap.set(custName, existing);
  }

  const customerAggRows = Array.from(customerAggMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .map((c, idx) => {
      const formattedItems = Array.from(c.itemsList.entries())
        .map(([name, data], i) => `${i + 1}. ${name} (${data.qty} ${data.unit})`)
        .join('\r\n');

      return {
        'No': idx + 1,
        'Nama Pelanggan': c.customerName,
        'Daftar Barang & Jumlah Dipesan (Ke Bawah)': formattedItems,
        'Jumlah Jenis Barang': c.itemsList.size,
        'Total Kuantitas (Qty)': c.totalQty,
        'Total Transaksi Invoice': c.totalInvoices.size,
        'Total Nilai Belanja (Rp)': c.totalSpent,
      };
    });

  const wsCustomers = XLSX.utils.json_to_sheet(
    customerAggRows.length > 0
      ? customerAggRows
      : [
          {
            'No': '-',
            'Nama Pelanggan': '-',
            'Daftar Barang & Jumlah Dipesan (Ke Bawah)': '-',
            'Jumlah Jenis Barang': 0,
            'Total Kuantitas (Qty)': 0,
            'Total Transaksi Invoice': 0,
            'Total Nilai Belanja (Rp)': 0,
          },
        ]
  );

  wsCustomers['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 55 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsCustomers, 'Rekap Pesanan Per Pelanggan');

  const today = new Date().toISOString().split('T')[0];
  triggerDownload(workbook, `Laporan-Invoice-dan-Barang-Keluar-${today}.xlsx`);
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

// 7. Export Single Invoice or Draft to Excel (.xlsx)
export function exportSingleInvoiceExcel(data: {
  invoice_number?: string;
  customer_name?: string;
  customer_address?: string;
  customer_phone?: string;
  activity_date?: string;
  due_date?: string;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  status?: string;
  notes?: string;
  items?: Array<{
    product_code?: string;
    product_name?: string;
    qty?: number;
    unit?: string;
    price?: number;
    subtotal?: number;
  }>;
}) {
  const workbook = XLSX.utils.book_new();

  const rawItems = Array.isArray(data.items) ? data.items : [];
  const statusLabel =
    data.status === 'paid'
      ? 'LUNAS (PAID)'
      : data.status === 'pending'
      ? 'MENUNGGU PEMBAYARAN'
      : data.status === 'cancelled'
      ? 'DIBATALKAN'
      : (data.status || 'DRAFT').toUpperCase();

  // Create formatted worksheet with metadata and items
  const sheetData: any[][] = [
    ['FAKTUR INVOICE'],
    ['Nomor Invoice', data.invoice_number || 'INV/DRAFT'],
    ['Tanggal', data.activity_date || new Date().toISOString().split('T')[0]],
    ['Status', statusLabel],
    ['Pelanggan / Klien', data.customer_name || '-'],
    ['Alamat', data.customer_address || '-'],
    ['Telepon', data.customer_phone || '-'],
    [''],
    ['No', 'Kode Produk', 'Deskripsi Barang / Layanan', 'Qty', 'Harga Satuan (Rp)', 'Subtotal (Rp)'],
  ];

  if (rawItems.length === 0) {
    sheetData.push(['-', '-', 'Belum ada rincian barang', 0, 0, 0]);
  } else {
    rawItems.forEach((it, idx) => {
      sheetData.push([
        idx + 1,
        it.product_code || '-',
        it.product_name || 'Barang',
        Number(it.qty) || 1, // Angka murni kuantitas tanpa embel-embel satuan
        Number(it.price) || 0,
        Number(it.subtotal) || 0,
      ]);
    });
  }

  sheetData.push(['']);
  sheetData.push(['', '', '', 'Subtotal (Rp)', '', Number(data.subtotal) || 0]);
  if (data.discount_amount) {
    sheetData.push(['', '', '', 'Diskon (Rp)', '', Number(data.discount_amount) || 0]);
  }
  if (data.tax_amount) {
    sheetData.push(['', '', '', 'PPN (Rp)', '', Number(data.tax_amount) || 0]);
  }
  sheetData.push(['', '', '', 'Total Akhir (Rp)', '', Number(data.total_amount) || 0]);

  if (data.notes) {
    sheetData.push(['']);
    sheetData.push(['Catatan:', data.notes]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 38 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');

  const safeName = (data.invoice_number || 'DRAFT').replace(/[^a-zA-Z0-9_-]/g, '-');
  triggerDownload(workbook, `Invoice-${safeName}.xlsx`);
}
