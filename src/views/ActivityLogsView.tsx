import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

interface ActivityLog {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export const ActivityLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<ActivityLog | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toast = useToast();

  const loadLogs = async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search,
      action: actionFilter,
      page: page.toString(),
      limit: '15',
    });

    const res = await apiRequest(`/api/activity-logs?${query.toString()}`);
    if (res.success && res.data) {
      setLogs(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } else {
      toast.error(res.message || 'Gagal memuat log aktivitas');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [search, actionFilter, page]);

  const handleDeleteLog = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await apiRequest(`/api/activity-logs/${deleteTarget.id}`, {
      method: 'DELETE',
    });
    setIsDeleting(false);
    if (res.success) {
      toast.success('Log aktivitas berhasil dihapus');
      setDeleteTarget(null);
      loadLogs();
    } else {
      toast.error(res.message || 'Gagal menghapus log aktivitas');
    }
  };

  const handleClearAllLogs = async () => {
    setIsDeleting(true);
    const res = await apiRequest('/api/activity-logs', {
      method: 'DELETE',
    });
    setIsDeleting(false);
    if (res.success) {
      toast.success('Seluruh riwayat log aktivitas berhasil dibersihkan');
      setIsClearAllModalOpen(false);
      loadLogs();
    } else {
      toast.error(res.message || 'Gagal membersihkan log aktivitas');
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('Login')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (action.includes('Logout')) {
      return 'bg-slate-100 text-slate-700 border-slate-200';
    }
    if (action.includes('Buat Invoice') || action.includes('Tambah')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('Edit') || action.includes('Ubah')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (action.includes('Hapus') || action.includes('Nonaktif')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('Import')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Log Aktivitas & Audit Sistem
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Rekam jejak tindakan administratif, perubahan data inventaris, dan penerbitan faktur
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {logs.length > 0 && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Semua Log</span>
            </button>
          )}

          <button
            onClick={loadLogs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <span>Segarkan Log</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari aktivitas, username, detail..."
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-56 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Jenis Aktivitas</option>
            <option value="Login">Login</option>
            <option value="Logout">Logout</option>
            <option value="Membuat Invoice">Membuat Invoice</option>
            <option value="Mengedit Invoice">Mengedit Invoice</option>
            <option value="Menghapus Invoice">Menghapus Invoice</option>
            <option value="Tambah Produk">Tambah Produk</option>
            <option value="Edit Produk">Edit Produk</option>
            <option value="Import Excel Produk">Import Excel</option>
            <option value="Hapus Produk">Hapus Produk</option>
            <option value="Mengubah Pengaturan">Mengubah Pengaturan</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-5 font-semibold">Waktu & Tanggal</th>
                <th className="py-3.5 px-5 font-semibold">Pengguna</th>
                <th className="py-3.5 px-5 font-semibold">Jenis Aktivitas</th>
                <th className="py-3.5 px-5 font-semibold">Deskripsi / Detail Tindakan</th>
                <th className="py-3.5 px-5 font-semibold text-right">Alamat IP</th>
                <th className="py-3.5 px-5 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat log aktivitas...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada riwayat aktivitas</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {log.created_at}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className="font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        @{log.username}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-slate-700 font-medium">
                      {log.details}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(log)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus baris log ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            Menampilkan <span className="font-semibold text-slate-700">{logs.length}</span> dari{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span> entri aktivitas
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

      {/* Delete Single Log Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Log Ini?</h3>
                <p className="text-xs text-slate-500">Konfirmasi penghapusan entri audit</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs space-y-1">
              <p className="font-bold text-slate-800">{deleteTarget.action}</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">{deleteTarget.details}</p>
              <p className="text-[10px] text-slate-400 pt-1 font-mono">{deleteTarget.created_at}</p>
            </div>

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
                onClick={handleDeleteLog}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Hapus Log'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Logs Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bersihkan Seluruh Riwayat Log?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50 p-3 rounded-xl border border-rose-200 leading-relaxed">
              ⚠️ Seluruh rekam jejak aktivitas pengguna dan riwayat audit administratif ({totalCount} entri) akan dihapus secara permanen dari basis data.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleClearAllLogs}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Membersihkan...' : 'Ya, Bersihkan Semua'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
