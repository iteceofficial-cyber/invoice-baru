import React, { useState, useEffect } from 'react';
import {
  FileText,
  TrendingDown,
  Package,
  DollarSign,
  Calendar,
  ArrowUpRight,
  Plus,
  Eye,
  Download,
  Printer,
  Sparkles,
  Layers,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, formatNumber, formatDateIndo } from '../lib/utils.ts';
import { generateInvoicePDF } from '../lib/pdfGenerator.ts';
import { useToast } from '../context/ToastContext.tsx';
import { NavTab } from '../components/Sidebar.tsx';

interface DashboardStats {
  totalInvoices: number;
  invoicesThisMonth: number;
  totalBarangKeluar: number;
  barangKeluarThisMonth: number;
  totalProduk: number;
  totalNilaiInvoice: number;
  nilaiInvoiceThisMonth: number;
  recentInvoices: any[];
  topProducts: any[];
  monthlyStats: Array<{
    month: string;
    label: string;
    revenue: number;
    itemsOut: number;
    count: number;
  }>;
}

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onPreviewInvoice: (invoiceId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onPreviewInvoice }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadStats = async () => {
    setLoading(true);
    const res = await apiRequest<DashboardStats>('/api/dashboard/stats');
    if (res.success && res.data) {
      setStats(res.data);
    } else {
      toast.error(res.message || 'Gagal memuat ringkasan dashboard');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleQuickDownloadPDF = async (invId: number) => {
    try {
      const res = await apiRequest(`/api/invoices/${invId}`);
      if (res.success && res.data) {
        generateInvoicePDF(res.data, 'download');
        toast.success(`Mengunduh PDF Invoice ${res.data.invoice_number}`);
      }
    } catch {
      toast.error('Gagal mengunduh PDF');
    }
  };

  const handleQuickPrint = async (invId: number) => {
    try {
      const res = await apiRequest(`/api/invoices/${invId}`);
      if (res.success && res.data) {
        generateInvoicePDF(res.data, 'print');
      }
    } catch {
      toast.error('Gagal mencetak Invoice');
    }
  };

  if (loading) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl p-5 border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Max value for chart scaling
  const maxRevenue = Math.max(...stats.monthlyStats.map((s) => s.revenue), 1000000);
  const maxItems = Math.max(...stats.monthlyStats.map((s) => s.itemsOut), 10);
  const maxTopQty = Math.max(...stats.topProducts.map((p) => p.total_qty), 1);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#136239] via-emerald-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/20">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold mb-3 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Info Papandayan • Portal Invoice & Logistik Wisata
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat Datang di Portal Admin
            </h1>
            <p className="text-emerald-100 text-sm mt-1 max-w-xl">
              Informasi Lengkap, Wisata Tanpa Ragu. Kelola faktur tagihan resmi, monitor inventaris, dan cetak invoice format A4 berlogo Info Papandayan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('create-invoice')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#136239] hover:bg-emerald-50 font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#136239]" />
              Buat Invoice Baru
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/20 text-white font-medium text-sm backdrop-blur-md transition-all border border-white/20 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              Kelola Produk
            </button>
          </div>
        </div>
      </div>

      {/* 5 Main Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Invoices */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Invoice
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(stats.totalInvoices)}
            </p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-bold">
                {stats.invoicesThisMonth} transaksi
              </span>{' '}
              bulan ini
            </p>
          </div>
        </div>

        {/* Invoice Bulan Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Invoice Bulan Ini
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-indigo-600 tracking-tight">
              {formatNumber(stats.invoicesThisMonth)}
            </p>
            <p className="text-xs text-slate-500 mt-1 truncate">
              Nilai: <span className="font-semibold text-slate-700">{formatRupiah(stats.nilaiInvoiceThisMonth)}</span>
            </p>
          </div>
        </div>

        {/* Total Barang Keluar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Barang Keluar
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(stats.totalBarangKeluar)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-amber-600 font-bold">
                {formatNumber(stats.barangKeluarThisMonth)} item
              </span>{' '}
              bulan berjalan
            </p>
          </div>
        </div>

        {/* Total Produk */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Produk Aktif
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatNumber(stats.totalProduk)}
            </p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-bold">Katalog Siap</span> jual
            </p>
          </div>
        </div>

        {/* Total Nilai Invoice */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Omset Invoice
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg sm:text-xl font-extrabold text-emerald-600 tracking-tight truncate" title={formatRupiah(stats.totalNilaiInvoice)}>
              {formatRupiah(stats.totalNilaiInvoice)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Akumulasi seluruh faktur</p>
          </div>
        </div>
      </div>

      {/* Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Grafik Invoice & Pengeluaran Barang */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Grafik Omset Invoice & Volume Barang Keluar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tren perkembangan performa penjualan selama 6 bulan terakhir
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                  <span className="text-slate-600">Nilai Invoice (Rp)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="text-slate-600">Qty Barang Keluar</span>
                </div>
              </div>
            </div>

            {/* Custom Interactive SVG/HTML Bar & Curve Chart */}
            <div className="h-64 flex items-end gap-3 sm:gap-6 pt-6 pb-2 border-b border-slate-100">
              {stats.monthlyStats.map((item, idx) => {
                const heightPercent = Math.max(12, Math.round((item.revenue / maxRevenue) * 100));
                const itemPercent = Math.max(8, Math.round((item.itemsOut / maxItems) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap pointer-events-none transition-all">
                      <span className="font-bold">{item.label}</span>
                      <span>Omset: {formatRupiah(item.revenue)}</span>
                      <span>Barang: {item.itemsOut} unit</span>
                    </div>

                    <div className="w-full max-w-[42px] flex items-end justify-center gap-1.5 h-full">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-1/2 bg-blue-600 rounded-t-md hover:bg-blue-700 transition-all duration-300 relative group-hover:shadow-lg group-hover:shadow-blue-500/30"
                      />
                      {/* Items Out Bar */}
                      <div
                        style={{ height: `${itemPercent}%` }}
                        className="w-1/2 bg-amber-400 rounded-t-md hover:bg-amber-500 transition-all duration-300 relative"
                      />
                    </div>

                    <div className="text-[11px] font-semibold text-slate-500 mt-2 truncate w-full text-center">
                      {item.label.split(' ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Data diperbarui secara real-time berdasarkan transaksi</span>
            <button
              onClick={() => onNavigate('reports')}
              className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              Lihat Laporan Lengkap <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barang Paling Sering Keluar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Barang Paling Sering Keluar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Top produk berdasarkan kuantitas transaksi</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Belum ada barang keluar</p>
              ) : (
                stats.topProducts.map((prod, idx) => {
                  const pct = Math.round((prod.total_qty / maxTopQty) * 100);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="truncate font-semibold text-slate-800 max-w-[170px]" title={prod.product_name}>
                          <span className="text-blue-600 font-mono text-[11px] mr-1.5">{prod.product_code}</span>
                          {prod.product_name}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-900">
                            {prod.total_qty} {prod.unit || 'Unit'}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full ${
                            idx === 0
                              ? 'bg-blue-600'
                              : idx === 1
                              ? 'bg-indigo-600'
                              : idx === 2
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Total Nilai Terjual</span>
                        <span className="font-medium text-slate-600">{formatRupiah(prod.total_value)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onNavigate('products')}
              className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold text-center transition cursor-pointer"
            >
              Lihat Seluruh Stok Produk
            </button>
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Invoice Terbaru</h3>
            <p className="text-xs text-slate-500 mt-0.5">Daftar transaksi faktur yang baru saja diterbitkan</p>
          </div>

          <button
            onClick={() => onNavigate('invoices')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Lihat Semua Invoice ({stats.totalInvoices}) <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-6 font-semibold">Nomor Invoice</th>
                <th className="py-3.5 px-6 font-semibold">Pelanggan / Klien</th>
                <th className="py-3.5 px-6 font-semibold">Tanggal</th>
                <th className="py-3.5 px-6 font-semibold">Total Nilai</th>
                <th className="py-3.5 px-6 font-semibold">Status</th>
                <th className="py-3.5 px-6 font-semibold text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada invoice yang dibuat
                  </td>
                </tr>
              ) : (
                stats.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-blue-600 text-xs">
                      {inv.invoice_number}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-900">
                      {inv.customer_name}
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {formatDateIndo(inv.activity_date)}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      {formatRupiah(inv.total_amount)}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
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
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onPreviewInvoice(inv.id)}
                          title="Lihat / Preview"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickDownloadPDF(inv.id)}
                          title="Download PDF"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleQuickPrint(inv.id)}
                          title="Print / Cetak"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
