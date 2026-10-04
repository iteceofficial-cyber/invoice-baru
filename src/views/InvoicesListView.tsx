import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Download,
  Printer,
  Calendar,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, formatDateIndo } from '../lib/utils.ts';
import { generateInvoicePDF, InvoicePDFData } from '../lib/pdfGenerator.ts';
import { useToast } from '../context/ToastContext.tsx';
import { InvoicePreviewModal } from './InvoicePreviewModal.tsx';
import { NavTab } from '../components/Sidebar.tsx';
import { exportInvoicesListExcel } from '../lib/excelHelper.ts';

interface InvoiceRow {
  id: number;
  invoice_number: string;
  customer_name: string;
  activity_date: string;
  total_amount: number;
  status: string;
  item_count: number;
  total_qty: number;
  created_at: string;
  created_by_name?: string;
}

interface InvoicesListViewProps {
  onNavigate: (tab: NavTab) => void;
  onEditInvoice: (id: number) => void;
  previewInvoiceId?: number | null;
  onClearPreview?: () => void;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({
  onNavigate,
  onEditInvoice,
  previewInvoiceId,
  onClearPreview,
}) => {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Preview & Delete states
  const [previewData, setPreviewData] = useState<InvoicePDFData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<InvoiceRow | null>(null);

  const toast = useToast();

  const loadInvoices = async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search,
      status: statusFilter,
      start_date: startDate,
      end_date: endDate,
      page: page.toString(),
      limit: '10',
    });

    const res = await apiRequest(`/api/invoices?${query.toString()}`);
    if (res.success && res.data) {
      setInvoices(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } else {
      toast.error(res.message || 'Gagal memuat invoice');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInvoices();
  }, [search, statusFilter, startDate, endDate, page]);

  // Handle external trigger for preview (e.g. from Dashboard)
  useEffect(() => {
    if (previewInvoiceId) {
      handleOpenPreview(previewInvoiceId);
      if (onClearPreview) onClearPreview();
    }
  }, [previewInvoiceId]);

  const handleOpenPreview = async (id: number) => {
    const res = await apiRequest(`/api/invoices/${id}`);
    if (res.success && res.data) {
      setPreviewData(res.data);
      setIsPreviewOpen(true);
    } else {
      toast.error('Gagal memuat detail invoice');
    }
  };

  const handleDownloadPDF = async (id: number) => {
    try {
      const res = await apiRequest(`/api/invoices/${id}`);
      if (res.success && res.data) {
        generateInvoicePDF(res.data, 'download');
        toast.success(`Mengunduh PDF: ${res.data.invoice_number}`);
      }
    } catch {
      toast.error('Gagal mengunduh PDF');
    }
  };

  const handlePrintInvoice = async (id: number) => {
    try {
      const res = await apiRequest(`/api/invoices/${id}`);
      if (res.success && res.data) {
        generateInvoicePDF(res.data, 'print');
      }
    } catch {
      toast.error('Gagal mencetak invoice');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteInvoiceTarget) return;
    const res = await apiRequest(`/api/invoices/${deleteInvoiceTarget.id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      toast.success(res.message || 'Invoice berhasil dihapus dan stok barang dikembalikan');
      setDeleteInvoiceTarget(null);
      loadInvoices();
    } else {
      toast.error(res.message || 'Gagal menghapus invoice');
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await apiRequest('/api/invoices?limit=2000');
      if (res.success && res.data && res.data.length > 0) {
        exportInvoicesListExcel(res.data);
      } else {
        exportInvoicesListExcel(invoices);
      }
      toast.success('Daftar invoice berhasil diekspor ke Excel!');
    } catch {
      exportInvoicesListExcel(invoices);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Daftar Seluruh Invoice
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pantau status tagihan faktur, download cetakan PDF A4, dan kelola arsip transaksi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => onNavigate('create-invoice')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Invoice Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nomor invoice, klien, alamat..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status Invoice</option>
              <option value="paid">Lunas (Paid)</option>
              <option value="pending">Menunggu Pembayaran (Pending)</option>
              <option value="cancelled">Dibatalkan (Cancelled)</option>
              <option value="draft">Draft</option>
            </select>
          </div>

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
              className="w-full pl-12 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
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
              className="w-full pl-16 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-5 font-semibold">Nomor Invoice</th>
                <th className="py-3.5 px-5 font-semibold">Pelanggan / Klien</th>
                <th className="py-3.5 px-5 font-semibold">Tanggal Kegiatan</th>
                <th className="py-3.5 px-5 font-semibold text-center">Jml Barang</th>
                <th className="py-3.5 px-5 font-semibold text-right">Total Tagihan</th>
                <th className="py-3.5 px-5 font-semibold text-center">Status</th>
                <th className="py-3.5 px-5 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat daftar invoice...</span>
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada invoice ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Coba sesuaikan filter pencarian atau buat invoice baru
                    </p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <span className="font-mono text-xs font-bold text-[#136239] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 leading-tight">
                        {inv.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Oleh: {inv.created_by_name || 'Admin'}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-slate-600 text-xs font-medium">
                      {formatDateIndo(inv.activity_date)}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className="text-xs font-semibold text-slate-700">
                        {inv.item_count || 1} jenis ({inv.total_qty || 0} unit)
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right font-extrabold text-slate-900 text-sm">
                      {formatRupiah(inv.total_amount)}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : inv.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {inv.status === 'paid'
                          ? 'Lunas'
                          : inv.status === 'pending'
                          ? 'Menunggu'
                          : inv.status === 'cancelled'
                          ? 'Dibatalkan'
                          : 'Draft'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenPreview(inv.id)}
                          title="Lihat / Preview A4"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(inv.id)}
                          title="Download PDF"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrintInvoice(inv.id)}
                          title="Print / Cetak"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditInvoice(inv.id)}
                          title="Edit Invoice"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteInvoiceTarget(inv)}
                          title="Hapus Invoice"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-700">{invoices.length}</span> dari{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span> total invoice
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold px-2">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Preview */}
      {previewData && (
        <InvoicePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          data={previewData}
        />
      )}

      {/* Modal Confirm Delete */}
      {deleteInvoiceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Invoice</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan mengembalikan stok produk</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 py-2">
              Apakah Anda yakin ingin menghapus faktur <strong className="text-slate-900">{deleteInvoiceTarget.invoice_number}</strong> (Klien: {deleteInvoiceTarget.customer_name})?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setDeleteInvoiceTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Ya, Hapus Faktur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
