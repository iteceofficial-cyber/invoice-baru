import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Building2,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, formatNumber } from '../lib/utils.ts';
import { useToast } from '../context/ToastContext.tsx';
import { exportCustomersListExcel } from '../lib/excelHelper.ts';

interface Customer {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
  invoice_count: number;
  total_spent: number;
}

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    notes: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Bulk selection and delete state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const toast = useToast();

  const loadCustomers = async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search,
      page: page.toString(),
      limit: '10',
    });

    const res = await apiRequest(`/api/customers?${query.toString()}`);
    if (res.success && res.data) {
      setCustomers(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } else {
      toast.error(res.message || 'Gagal memuat pelanggan');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers();
  }, [search, page]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', address: '', phone: '', email: '', notes: '' });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      address: c.address || '',
      phone: c.phone || '',
      email: c.email || '',
      notes: c.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama pelanggan/perusahaan wajib diisi');
      return;
    }

    if (editingCustomer) {
      const res = await apiRequest(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      if (res.success) {
        toast.success('Data pelanggan berhasil diperbarui');
        setIsFormOpen(false);
        loadCustomers();
      } else {
        toast.error(res.message || 'Gagal menyimpan perubahan');
      }
    } else {
      const res = await apiRequest('/api/customers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (res.success) {
        toast.success('Pelanggan baru berhasil ditambahkan');
        setIsFormOpen(false);
        loadCustomers();
      } else {
        toast.error(res.message || 'Gagal menambahkan pelanggan');
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await apiRequest(`/api/customers/${deleteTarget.id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      toast.success(res.message || 'Pelanggan berhasil dihapus');
      setDeleteTarget(null);
      loadCustomers();
    } else {
      toast.error(res.message || 'Gagal menghapus pelanggan');
    }
  };

  // Bulk selection handlers
  const isAllCurrentSelected = customers.length > 0 && customers.every((c) => selectedCustomerIds.includes(c.id));
  const isSomeSelected = customers.some((c) => selectedCustomerIds.includes(c.id));

  const toggleSelectAll = () => {
    if (isAllCurrentSelected) {
      const currentIds = customers.map((c) => c.id);
      setSelectedCustomerIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      const currentIds = customers.map((c) => c.id);
      setSelectedCustomerIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const toggleSelectCustomer = (id: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDatabase = async () => {
    try {
      const res = await apiRequest('/api/customers?all=true');
      if (res.success && res.data) {
        setSelectedCustomerIds(res.data.map((c: Customer) => c.id));
        toast.info(`Semua ${res.data.length} pelanggan telah dipilih`);
      }
    } catch {
      setSelectedCustomerIds(customers.map((c) => c.id));
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) return;
    setIsBulkDeleting(true);
    const res = await apiRequest('/api/customers/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedCustomerIds }),
    });
    setIsBulkDeleting(false);

    if (res.success) {
      toast.success(res.message || `${selectedCustomerIds.length} pelanggan berhasil dihapus`);
      setSelectedCustomerIds([]);
      setIsBulkDeleteOpen(false);
      loadCustomers();
    } else {
      toast.error(res.message || 'Gagal menghapus pelanggan terpilih');
    }
  };

  const handleClearAllCustomers = async () => {
    setIsClearingAll(true);
    const res = await apiRequest('/api/customers', {
      method: 'DELETE',
    });
    setIsClearingAll(false);
    if (res.success) {
      toast.success(res.message || 'Seluruh database pelanggan berhasil dihapus');
      setIsClearAllModalOpen(false);
      loadCustomers();
    } else {
      toast.error(res.message || 'Gagal menghapus database pelanggan');
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await apiRequest('/api/customers?all=true');
      if (res.success && res.data && res.data.length > 0) {
        exportCustomersListExcel(res.data);
      } else {
        exportCustomersListExcel(customers);
      }
      toast.success('Daftar pelanggan berhasil diekspor ke Excel!');
    } catch {
      exportCustomersListExcel(customers);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Data Pelanggan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Database klien penerima faktur, riwayat pembelian, dan informasi kontak
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(customers.length > 0 || totalCount > 0) && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Database Pelanggan</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pelanggan</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama perusahaan, kontak, atau email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedCustomerIds.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {selectedCustomerIds.length}
            </span>
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-950">
                {selectedCustomerIds.length} pelanggan terpilih
              </p>
              <p className="text-[11px] text-amber-800">
                Tindakan masal untuk data pelanggan yang telah diceklis
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold transition cursor-pointer"
            >
              {isAllCurrentSelected ? 'Batalkan di Halaman Ini' : `Pilih Semua Halaman Ini (${customers.length})`}
            </button>
            <button
              type="button"
              onClick={handleSelectAllDatabase}
              className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold transition cursor-pointer"
            >
              Pilih Seluruh Database ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCustomerIds([])}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setIsBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus ({selectedCustomerIds.length}) Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected && !isAllCurrentSelected;
                    }}
                    onChange={toggleSelectAll}
                    title="Pilih Semua di Halaman Ini"
                    className="w-4 h-4 rounded-md accent-[#136239] border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-5 font-semibold">Nama Pelanggan / Perusahaan</th>
                <th className="py-3.5 px-5 font-semibold">Kontak</th>
                <th className="py-3.5 px-5 font-semibold text-center">Total Faktur</th>
                <th className="py-3.5 px-5 font-semibold text-right">Total Transaksi</th>
                <th className="py-3.5 px-5 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data pelanggan...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Belum ada pelanggan terdaftar</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tambahkan pelanggan untuk mempercepat pengisian otomatis pada invoice
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedCustomerIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCustomer(c.id)}
                          className="w-4 h-4 rounded-md accent-[#136239] border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 leading-tight flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{c.name}</span>
                        </div>
                        {c.notes && (
                          <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={c.notes}>
                            {c.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5 text-xs text-slate-600 space-y-0.5">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {c.email}
                          </div>
                        )}
                        {!c.phone && !c.email && '-'}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {c.invoice_count || 0} Invoice
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right font-extrabold text-slate-900 text-xs">
                        {formatRupiah(c.total_spent || 0)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Pelanggan"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            title="Hapus Pelanggan"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-700">{customers.length}</span> dari{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span> pelanggan
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

      {/* MODAL: Tambah / Edit Pelanggan */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Pelanggan / Perusahaan *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: PT Mega Cahaya Abadi"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Nama gedung, jalan, nomor, kota"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    No. Telepon / HP
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="021-xxxx atau 0812-xxxx"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="kontak@perusahaan.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan Khusus
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ketentuan tempo pembayaran, PIC pengadaan, dll."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer transition"
                >
                  {editingCustomer ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION: Hapus Pelanggan */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Pelanggan</h3>
                <p className="text-xs text-slate-500">Tindakan menghapus dari database</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 py-2">
              Hapus pelanggan <strong className="text-slate-900">{deleteTarget.name}</strong> dari daftar?
              <span className="block mt-1 text-xs text-slate-500">
                Riwayat transaksi pada faktur yang telah diterbitkan tetap tersimpan aman.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: Hapus Seluruh Database Pelanggan */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 shrink-0">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Seluruh Database Pelanggan?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p className="font-bold">⚠️ Perhatian:</p>
              <p>
                Seluruh data pada direktori pelanggan ({totalCount} pelanggan) akan dihapus secara permanen.
              </p>
              <p className="text-slate-600 text-[11px] pt-1">
                Catatan: Invoice transaksi yang telah terbit sebelumnya akan tetap tersimpan secara aman dengan mencantumkan nama pelanggan tersebut.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleClearAllCustomers}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isClearingAll ? 'Menghapus...' : 'Ya, Hapus Database Pelanggan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: Hapus Masal Pelanggan Terpilih */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus {selectedCustomerIds.length} Pelanggan Terpilih?</h3>
                <p className="text-xs text-slate-500">Tindakan ini menghapus data kontak dari database</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 py-2">
              Apakah Anda yakin ingin menghapus <strong className="text-slate-900">{selectedCustomerIds.length} pelanggan</strong> yang diceklis?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl mb-4 border border-slate-200">
              Catatan: Faktur invoice transaksi yang telah terbit sebelumnya akan tetap tersimpan aman beserta histori nama pelanggannya.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus {selectedCustomerIds.length} Pelanggan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
