import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Package,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  CalendarDays,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, formatNumber, formatDateIndo } from '../lib/utils.ts';
import { generateItemsOutPDF } from '../lib/pdfGenerator.ts';
import { downloadMonthlyReportExcel } from '../lib/excelHelper.ts';
import { useToast } from '../context/ToastContext.tsx';

interface ReportItem {
  item_id: number;
  invoice_id: number;
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
  invoice_status: string;
}

interface ReportSummary {
  total_transaksi: number;
  total_jenis_barang: number;
  total_qty_keluar: number;
  total_nilai_keluar: number;
}

export const ReportsView: React.FC = () => {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    total_transaksi: 0,
    total_jenis_barang: 0,
    total_qty_keluar: 0,
    total_nilai_keluar: 0,
  });
  const [loading, setLoading] = useState(true);

  // Month selector for monthly report
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultYearMonth);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  // Delete target state
  const [deleteTarget, setDeleteTarget] = useState<ReportItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch delete state
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const toast = useToast();

  const loadReportData = async () => {
    setLoading(true);
    const query = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      customer_name: customerName,
      invoice_number: invoiceNumber,
      page: page.toString(),
      limit: '15',
    });

    const res = await apiRequest(`/api/reports/items-out?${query.toString()}`);
    if (res.success && res.data) {
      setItems(res.data);
      if (res.summary) setSummary(res.summary);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalRows(res.pagination.total || 0);
      }
    } else {
      toast.error(res.message || 'Gagal memuat laporan barang keluar');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate, customerName, invoiceNumber, page]);

  // Delete single logistics item and restore stock
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await apiRequest(`/api/reports/items-out/${deleteTarget.item_id}`, {
      method: 'DELETE',
    });
    setIsDeleting(false);
    if (res.success) {
      toast.success(res.message || 'Rincian barang keluar berhasil dihapus');
      setSelectedItemIds((prev) => prev.filter((id) => id !== deleteTarget.item_id));
      setDeleteTarget(null);
      loadReportData();
    } else {
      toast.error(res.message || 'Gagal menghapus rincian barang keluar');
    }
  };

  // Batch delete selected items
  const handleConfirmBatchDelete = async () => {
    if (selectedItemIds.length === 0) return;
    setIsBatchDeleting(true);
    const res = await apiRequest('/api/reports/items-out/delete-batch', {
      method: 'POST',
      body: JSON.stringify({ itemIds: selectedItemIds }),
    });
    setIsBatchDeleting(false);
    if (res.success) {
      toast.success(res.message || 'Rincian barang terpilih berhasil dihapus');
      setSelectedItemIds([]);
      setIsBatchModalOpen(false);
      loadReportData();
    } else {
      toast.error(res.message || 'Gagal menghapus barang keluar');
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === items.length && items.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((i) => i.item_id));
    }
  };

  const handleToggleSelectItem = (id: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Set filter by month preset
  const handleApplyMonthFilter = (yearMonth: string) => {
    setSelectedMonth(yearMonth);
    if (!yearMonth) {
      setStartDate('');
      setEndDate('');
      setPage(1);
      return;
    }
    const [year, month] = yearMonth.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    setStartDate(`${yearMonth}-01`);
    setEndDate(`${yearMonth}-${String(lastDay).padStart(2, '0')}`);
    setPage(1);
  };

  // Download dedicated monthly report Excel (Requirement #4: "buat juga laporan excel per bulan")
  const handleDownloadMonthlyExcel = async () => {
    try {
      const ym = selectedMonth || defaultYearMonth;
      const [year, month] = ym.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const sDate = `${ym}-01`;
      const eDate = `${ym}-${String(lastDay).padStart(2, '0')}`;

      const res = await apiRequest(`/api/reports/items-out?start_date=${sDate}&end_date=${eDate}&limit=5000`);
      if (res.success && res.data) {
        const monthItems = res.data;
        const totalNilai = monthItems.reduce((acc: number, curr: any) => acc + (curr.total_nilai || 0), 0);
        const totalQty = monthItems.reduce((acc: number, curr: any) => acc + (curr.jumlah || 0), 0);
        const uniqueProducts = new Set(monthItems.map((x: any) => x.nama_barang)).size;
        const uniqueInvoices = new Set(monthItems.map((x: any) => x.nomor_invoice)).size;

        downloadMonthlyReportExcel({
          yearMonth: ym,
          items: monthItems,
          summary: {
            total_transaksi: uniqueInvoices,
            total_jenis_barang: uniqueProducts,
            total_qty_keluar: totalQty,
            total_nilai_keluar: totalNilai,
          },
        });
        toast.success(`Laporan Excel Bulan ${ym} berhasil diunduh!`);
      } else {
        toast.error('Gagal memuat data transaksi bulanan');
      }
    } catch (err: any) {
      toast.error('Gagal mengunduh laporan excel: ' + err.message);
    }
  };

  // Export filtered data to Excel
  const handleExportFilteredExcel = async () => {
    try {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        customer_name: customerName,
        invoice_number: invoiceNumber,
        category_id: selectedCategory,
        limit: '5000',
      });
      const res = await apiRequest(`/api/reports/items-out?${query.toString()}`);
      if (res.success && res.data) {
        downloadMonthlyReportExcel({
          yearMonth: selectedMonth || 'Periode-Pilihan',
          items: res.data,
          summary: res.summary || summary,
        });
        toast.success('Laporan Barang Keluar berhasil diekspor ke Excel!');
      } else {
        downloadMonthlyReportExcel({
          yearMonth: 'Periode-Pilihan',
          items: items,
          summary: summary,
        });
      }
    } catch {
      downloadMonthlyReportExcel({
        yearMonth: 'Periode-Pilihan',
        items: items,
        summary: summary,
      });
    }
  };

  // Download PDF
  const handleDownloadPDF = () => {
    if (items.length === 0) {
      toast.warning('Tidak ada data barang keluar untuk dicetak');
      return;
    }
    const filterLabel = startDate || endDate ? `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}` : 'Semua Periode';
    generateItemsOutPDF(items, summary, filterLabel);
    toast.success('Mengunduh Laporan Barang Keluar dalam format PDF');
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setCustomerName('');
    setInvoiceNumber('');
    setSelectedCategory('');
    setSelectedMonth('');
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Laporan Pengeluaran Barang
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Data rekapitulasi barang keluar otomatis tercatat berdasarkan invoice resmi Info Papandayan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Monthly Excel Report Button (Requirement #4) */}
          <button
            onClick={handleDownloadMonthlyExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-[#136239] text-xs font-bold shadow-xs transition cursor-pointer"
            title="Download Laporan Excel Khusus Per Bulan dengan 3 Sheet Rekapitulasi"
          >
            <CalendarDays className="w-4 h-4 text-[#136239]" />
            <span>Laporan Excel Per Bulan</span>
          </button>

          <button
            onClick={handleExportFilteredExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#136239]" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF Laporan</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transaksi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Transaksi Invoice
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#136239] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(summary.total_transaksi)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Faktur terverifikasi keluar</p>
          </div>
        </div>

        {/* Total Jenis Barang Keluar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Jenis Produk
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-teal-700 tracking-tight">
              {formatNumber(summary.total_jenis_barang)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Varian produk dikeluarkan</p>
          </div>
        </div>

        {/* Total Quantity Keluar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Kuantitas Barang Keluar
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-amber-600 tracking-tight">
              {formatNumber(summary.total_qty_keluar)} Unit
            </p>
            <p className="text-xs text-slate-500 mt-1">Total fisik unit disalurkan</p>
          </div>
        </div>

        {/* Total Nilai Barang Keluar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Nilai Barang
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#136239] flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg sm:text-xl font-extrabold text-[#136239] tracking-tight truncate">
              {formatRupiah(summary.total_nilai_keluar)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Akumulasi nilai penjualan</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Filter className="w-3.5 h-3.5 text-[#136239]" />
            Filter Periode & Kriteria Pencarian
          </div>

          {/* Quick Month Preset Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Pilih Bulan:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleApplyMonthFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#136239]"
            />
            <button
              onClick={() => handleApplyMonthFilter(defaultYearMonth)}
              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#136239] text-[11px] font-bold transition cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              onClick={handleResetFilter}
              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Start Date */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-slate-400">
              Dari:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full pl-12 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#136239]"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-slate-400">
              Sampai:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full pl-16 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#136239]"
            />
          </div>

          {/* Customer */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setPage(1);
              }}
              placeholder="Cari Pelanggan..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#136239]"
            />
          </div>

          {/* Invoice Number */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => {
                setInvoiceNumber(e.target.value);
                setPage(1);
              }}
              placeholder="Nomor Invoice..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#136239]"
            />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#136239]" />
            <h3 className="text-sm font-bold text-slate-800">
              Rincian Logistik Barang Keluar
            </h3>
            <span className="text-xs text-slate-400">
              ({totalRows} catatan transaksi)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedItemIds.length > 0 && (
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus ({selectedItemIds.length}) Item Terpilih</span>
              </button>
            )}

            {selectedMonth && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-[#136239] border border-emerald-200">
                Periode Bulan: {selectedMonth}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItemIds.length === items.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#136239] focus:ring-[#136239] cursor-pointer"
                    title="Pilih semua baris pada halaman ini"
                  />
                </th>
                <th className="py-3.5 px-3 text-center w-12">No</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">No. Invoice</th>
                <th className="py-3.5 px-4">Pelanggan</th>
                <th className="py-3.5 px-4">Kode</th>
                <th className="py-3.5 px-4">Nama Barang</th>
                <th className="py-3.5 px-4 text-center">Qty</th>
                <th className="py-3.5 px-4 text-right">Harga Satuan</th>
                <th className="py-3.5 px-4 text-right">Total Nilai</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={11} className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <TrendingDown className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Tidak ada data barang keluar yang ditemukan</p>
                    <p className="text-xs mt-1">Coba sesuaikan filter rentang tanggal atau kriteria pencarian</p>
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={it.item_id}
                    className={`transition ${
                      selectedItemIds.includes(it.item_id) ? 'bg-emerald-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(it.item_id)}
                        onChange={() => handleToggleSelectItem(it.item_id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#136239] focus:ring-[#136239] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">
                      {(page - 1) * 15 + idx + 1}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      {formatDateIndo(it.tanggal)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-[#136239]">
                        {it.nomor_invoice}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 max-w-[160px] truncate">
                      {it.nama_pelanggan}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {it.kode_produk}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-[200px] truncate">
                      {it.nama_barang}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900 whitespace-nowrap">
                      {formatNumber(it.jumlah)} {it.satuan}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                      {formatRupiah(it.harga)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#136239] whitespace-nowrap">
                      {formatRupiah(it.total_nilai)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(it)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 transition cursor-pointer font-semibold text-[11px]"
                        title="Hapus rincian barang keluar & kembalikan stok"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan Halaman <span className="font-bold">{page}</span> dari{' '}
              <span className="font-bold">{totalPages}</span> (Total {totalRows} baris)
            </p>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                if (totalPages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                  return null;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                      page === p
                        ? 'bg-[#136239] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Rincian Barang Keluar?</h3>
                <p className="text-xs text-slate-500">Konfirmasi pembatalan item barang logistik</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
              <p className="font-semibold text-slate-800">
                Barang: <span className="font-bold text-slate-900">{deleteTarget.nama_barang}</span>
              </p>
              <p className="text-slate-600">
                No. Faktur: <span className="font-mono font-bold text-[#136239]">{deleteTarget.nomor_invoice}</span>
              </p>
              <p className="text-slate-600">
                Pelanggan: <span className="font-semibold text-slate-800">{deleteTarget.nama_pelanggan}</span>
              </p>
              <p className="text-slate-600">
                Jumlah: <span className="font-bold text-slate-900">{deleteTarget.jumlah} {deleteTarget.satuan}</span> (Nilai: {formatRupiah(deleteTarget.total_nilai)})
              </p>
            </div>

            <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 leading-relaxed">
              ⚠️ Tindakan ini akan menghapus baris item dari invoice terkait dan <strong>mengembalikan stok barang ({deleteTarget.jumlah} {deleteTarget.satuan})</strong> ke katalog inventaris.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus & Kembalikan Stok'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus {selectedItemIds.length} Rincian Terpilih?</h3>
                <p className="text-xs text-slate-500">Konfirmasi pembatalan massal item barang keluar</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              <p className="font-semibold text-slate-800 border-b border-slate-200 pb-1">
                Daftar Item yang Akan Dihapus:
              </p>
              {items
                .filter((it) => selectedItemIds.includes(it.item_id))
                .map((it) => (
                  <div key={it.item_id} className="flex justify-between items-center py-1 text-slate-700 text-[11px] border-b border-slate-100 last:border-0">
                    <span className="font-medium truncate max-w-[220px]">{it.nama_barang}</span>
                    <span className="font-bold text-[#136239] shrink-0 font-mono">+{it.jumlah} {it.satuan}</span>
                  </div>
                ))}
            </div>

            <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 leading-relaxed">
              ⚠️ Seluruh stok dari item terpilih akan otomatis <strong>dikembalikan ke inventaris produk</strong> dan total nilai faktur terkait akan diperbarui.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isBatchDeleting}
                onClick={handleConfirmBatchDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBatchDeleting ? 'Menghapus...' : `Ya, Hapus (${selectedItemIds.length}) Item`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
