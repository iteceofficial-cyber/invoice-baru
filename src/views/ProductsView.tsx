import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  FileDown,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Save,
  CheckSquare,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, formatNumber } from '../lib/utils.ts';
import { useToast } from '../context/ToastContext.tsx';
import {
  downloadProductImportTemplate,
  exportProductsListExcel,
  parseProductImportExcel,
} from '../lib/excelHelper.ts';

interface Product {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  category_name?: string;
  unit: string;
  price: number;
  stock: number;
  status: string;
  description?: string;
}

interface Category {
  id: number;
  name: string;
}

interface ImportRow {
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

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: '',
    unit: 'Pcs',
    price: '',
    stock: '',
    status: 'active',
    description: '',
  });

  // Import Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    validCount: number;
    errorCount: number;
    rows: ImportRow[];
  } | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  // Bulk selection and delete state
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const toast = useToast();

  const loadCategories = async () => {
    const res = await apiRequest('/api/categories');
    if (res.success && res.data) {
      setCategories(res.data);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    const query = new URLSearchParams({
      search,
      category_id: selectedCategory,
      status: selectedStatus,
      sort_by: sortBy,
      sort_dir: sortDir,
      page: page.toString(),
      limit: '10',
    });

    const res = await apiRequest(`/api/products?${query.toString()}`);
    if (res.success && res.data) {
      setProducts(res.data);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setTotalItems(res.pagination.total || 0);
      }
    } else {
      toast.error(res.message || 'Gagal memuat produk');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory, selectedStatus, sortBy, sortDir, page]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      code: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category_id: categories.length > 0 ? categories[0].id.toString() : '',
      unit: 'Pcs',
      price: '',
      stock: '0',
      status: 'active',
      description: '',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      code: p.code,
      name: p.name,
      category_id: p.category_id ? p.category_id.toString() : '',
      unit: p.unit || 'Pcs',
      price: p.price.toString(),
      stock: p.stock.toString(),
      status: p.status,
      description: p.description || '',
    });
    setIsFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Kode dan Nama Produk wajib diisi');
      return;
    }

    const payload = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      unit: formData.unit.trim() || 'Pcs',
      price: parseFloat(formData.price) || 0,
      stock: parseInt(formData.stock) || 0,
      status: formData.status,
      description: formData.description.trim(),
    };

    if (editingProduct) {
      const res = await apiRequest(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        toast.success('Produk berhasil diperbarui');
        setIsFormOpen(false);
        loadProducts();
      } else {
        toast.error(res.message || 'Gagal menyimpan perubahan');
      }
    } else {
      const res = await apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        toast.success('Produk baru berhasil ditambahkan');
        setIsFormOpen(false);
        loadProducts();
      } else {
        toast.error(res.message || 'Gagal menambahkan produk');
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteProduct) return;
    const res = await apiRequest(`/api/products/${deleteProduct.id}`, {
      method: 'DELETE',
    });
    if (res.success) {
      toast.success(res.message || 'Produk berhasil dihapus');
      setDeleteProduct(null);
      loadProducts();
    } else {
      toast.error(res.message || 'Gagal menghapus produk');
    }
  };

  // Toggle selection for all visible products on current page
  const isAllCurrentSelected = products.length > 0 && products.every((p) => selectedProductIds.includes(p.id));
  const isSomeSelected = products.some((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    if (isAllCurrentSelected) {
      // Unselect all products on this page
      const currentIds = products.map((p) => p.id);
      setSelectedProductIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      // Select all products on this page
      const currentIds = products.map((p) => p.id);
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllCatalog = async () => {
    try {
      const res = await apiRequest('/api/products?limit=10000');
      if (res.success && res.data) {
        setSelectedProductIds(res.data.map((p: Product) => p.id));
        toast.info(`Semua ${res.data.length} produk di katalog telah dipilih`);
      }
    } catch {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkDeleting(true);
    const res = await apiRequest('/api/products/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedProductIds }),
    });
    setIsBulkDeleting(false);

    if (res.success) {
      toast.success(res.message || `${selectedProductIds.length} produk berhasil dihapus`);
      setSelectedProductIds([]);
      setIsBulkDeleteOpen(false);
      loadProducts();
    } else {
      toast.error(res.message || 'Gagal menghapus produk terpilih');
    }
  };

  // Export products to excel
  const handleExportExcel = async () => {
    try {
      const res = await apiRequest('/api/products?limit=2000');
      if (res.success && res.data && res.data.length > 0) {
        exportProductsListExcel(res.data);
      } else {
        exportProductsListExcel(products);
      }
      toast.success('Daftar produk berhasil diekspor ke Excel');
    } catch {
      exportProductsListExcel(products);
    }
  };

  // Download template excel (Direct, reliable, no popup blocking)
  const handleDownloadTemplate = () => {
    downloadProductImportTemplate();
    toast.success('Template Excel berhasil diunduh. Silakan isi daftar produk, harga, dan kode barang.');
  };

  // Robust file processor for both file picker and drag-and-drop
  const processUploadFile = async (file: File) => {
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('File harus berformat Excel (.xlsx atau .xls)');
      return;
    }

    setImportFile(file);
    setImportLoading(true);
    setPreviewData(null);

    const data = new FormData();
    data.append('file', file);

    const res = await apiRequest('/api/products/import-preview', {
      method: 'POST',
      body: data,
    });

    setImportLoading(false);

    if (res.success) {
      setPreviewData({
        totalRows: res.totalRows,
        validCount: res.validCount,
        errorCount: res.errorCount,
        rows: res.rows,
      });
      toast.success(`Berhasil membaca ${res.totalRows} baris data dari ${file.name}`);
    } else {
      toast.error(res.message || 'Gagal membaca file Excel. Pastikan format tabel sesuai.');
      setImportFile(null);
    }
  };

  // Import file handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadFile(file);
    }
    // Reset file input value so user can upload the same file again if edited
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCommitImport = async () => {
    if (!previewData || previewData.validCount === 0) return;

    setCommitLoading(true);
    const validRows = previewData.rows.filter((r) => r.isValid);

    const res = await apiRequest('/api/products/import-commit', {
      method: 'POST',
      body: JSON.stringify({ rows: validRows }),
    });

    setCommitLoading(false);

    if (res.success) {
      toast.success(res.message || 'Data Excel berhasil disimpan');
      setIsImportOpen(false);
      setImportFile(null);
      setPreviewData(null);
      loadProducts();
      loadCategories();
    } else {
      toast.error(res.message || 'Gagal menyimpan produk');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Katalog & Manajemen Produk
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Kelola stok barang, harga jual, import/export spreadsheet, dan status inventaris
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Export ke Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              setIsImportOpen(true);
              setPreviewData(null);
              setImportFile(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-semibold transition cursor-pointer"
            title="Import Excel"
          >
            <Upload className="w-4 h-4" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari kode produk, nama barang, atau deskripsi..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id.toString()}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="id">Urutkan: Terbaru</option>
            <option value="name">Nama Barang</option>
            <option value="code">Kode Produk</option>
            <option value="price">Harga</option>
            <option value="stock">Stok</option>
          </select>

          <button
            onClick={() => setSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title={`Arah: ${sortDir === 'ASC' ? 'Menaik (A-Z)' : 'Menurun (Z-A)'}`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedProductIds.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {selectedProductIds.length}
            </span>
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-950">
                {selectedProductIds.length} produk terpilih
              </p>
              <p className="text-[11px] text-amber-800">
                Pilih tindakan masal untuk produk yang telah diceklis
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold transition cursor-pointer"
            >
              {isAllCurrentSelected ? 'Batalkan di Halaman Ini' : `Pilih Semua Halaman Ini (${products.length})`}
            </button>
            <button
              type="button"
              onClick={handleSelectAllCatalog}
              className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold transition cursor-pointer"
            >
              Pilih Seluruh Katalog ({totalItems})
            </button>
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
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
              <span>Hapus ({selectedProductIds.length}) Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
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
                    className="w-4 h-4 rounded-md accent-blue-600 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 font-semibold">Kode</th>
                <th className="py-3.5 px-5 font-semibold">Nama Produk</th>
                <th className="py-3.5 px-4 font-semibold">Satuan</th>
                <th className="py-3.5 px-4 font-semibold text-right">Harga Jual</th>
                <th className="py-3.5 px-4 font-semibold text-center">Stok</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-5 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data produk...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada produk ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Coba ubah kata kunci pencarian atau tambah produk baru
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLowStock = p.stock <= 10;
                  const isSelected = selectedProductIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-4 h-4 rounded-md accent-blue-600 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                          {p.code}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 leading-tight">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5" title={p.description}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600 text-xs font-medium">
                        {p.unit}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900 text-right">
                        {formatRupiah(p.price)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                            isLowStock
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {formatNumber(p.stock)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            p.status === 'active'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {p.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Produk"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteProduct(p)}
                            title="Hapus Produk"
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

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan <span className="font-semibold text-slate-700">{products.length}</span> dari{' '}
            <span className="font-semibold text-slate-700">{totalItems}</span> total produk
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

      {/* MODAL: Tambah / Edit Produk */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Informasi Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Kode Produk *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Contoh: PRD-001"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="Pcs / Box / Unit / Rim"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Barang / Produk *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Laptop Asus ExpertBook B1400"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">-- Tanpa Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id.toString()}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status Produk
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="active">Aktif (Tersedia)</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Harga Jual (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Contoh: 1500000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Stok Awal / Saat Ini *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="Contoh: 25"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Keterangan / Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Catatan spesifikasi tambahan..."
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
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {editingProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Import Excel with Preview & Row Validation */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Import Produk dari File Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unggah file Excel untuk menambah atau memperbarui produk sekaligus
                </p>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-4 flex-1 custom-scrollbar">
              {/* Upload Zone & Template Download */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Gunakan Format Template Resmi</h4>
                    <p className="text-xs text-slate-500">
                      Kolom wajib: Kode Produk, Nama Produk, Satuan, Harga, Stok
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-bold shadow-xs hover:bg-blue-50 transition shrink-0 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  Download Template Excel
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) processUploadFile(droppedFile);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/70 scale-[1.01]'
                    : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <Upload className={`w-8 h-8 mx-auto mb-2 transition ${isDragging ? 'text-blue-700 animate-bounce' : 'text-blue-600'}`} />
                <p className="text-sm font-bold text-slate-800">
                  {importFile ? importFile.name : 'Pilih atau Tarik File Excel ke Sini'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Mendukung format file .xlsx dan .xls (Kolom: Nama Produk, Harga, Stok, Satuan)
                </p>
                {importFile && (
                  <span className="inline-block mt-2 text-xs font-semibold text-blue-600 underline">
                    Klik untuk ganti file lain
                  </span>
                )}
              </div>

              {/* Parsing status spinner */}
              {importLoading && (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-semibold">Membaca dan memvalidasi baris Excel...</p>
                </div>
              )}

              {/* Highlight Save Banner right after Excel upload */}
              {previewData && (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-emerald-950">
                        {previewData.validCount} Data Produk Siap Disimpan!
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        File <span className="font-semibold">{importFile?.name}</span> telah selesai diverifikasi. Klik tombol di samping untuk menyimpan langsung ke database.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={commitLoading || previewData.validCount === 0}
                    onClick={handleCommitImport}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition cursor-pointer shrink-0 w-full sm:w-auto"
                  >
                    {commitLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Menyimpan ke Database...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan {previewData.validCount} Produk ke Database</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Preview Table with row error checking */}
              {previewData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">
                      Pratinjau Data Excel ({previewData.totalRows} baris)
                    </h4>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {previewData.validCount} Siap Disimpan
                      </span>
                      {previewData.errorCount > 0 && (
                        <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {previewData.errorCount} Baris Bermasalah
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Baris</th>
                          <th className="py-2.5 px-3 font-semibold">Kode</th>
                          <th className="py-2.5 px-3 font-semibold">Nama Produk</th>
                          <th className="py-2.5 px-3 font-semibold">Satuan</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Harga</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Stok</th>
                          <th className="py-2.5 px-3 font-semibold">Status Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.rows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-rose-50/70 text-rose-900'}
                          >
                            <td className="py-2 px-3 font-mono font-bold text-slate-500">
                              #{row.rowNumber}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold">
                              {row.code || '-'}
                            </td>
                            <td className="py-2 px-3 font-medium">
                              {row.name || '-'}
                            </td>
                            <td className="py-2 px-3">{row.unit}</td>
                            <td className="py-2 px-3 text-right font-medium">
                              {formatRupiah(row.price)}
                            </td>
                            <td className="py-2 px-3 text-center">{row.stock}</td>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {row.isUpdate ? 'Update Data' : 'Baru'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-bold" title={row.error}>
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                {previewData ? `${previewData.validCount} produk valid akan disimpan ke basis data.` : ''}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!previewData || previewData.validCount === 0 || commitLoading}
                  onClick={handleCommitImport}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-2"
                >
                  {commitLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <span>Konfirmasi & Simpan Produk</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: Hapus Produk */}
      {deleteProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Produk</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 py-2">
              Apakah Anda yakin ingin menghapus produk <strong className="text-slate-900">{deleteProduct.code} - {deleteProduct.name}</strong>?
            </p>
            <p className="text-xs text-slate-400 bg-slate-50 p-2.5 rounded-xl mb-4">
              Catatan: Jika produk ini pernah tercatat dalam invoice sebelumnya, sistem akan secara otomatis mengubah statusnya menjadi <strong>Nonaktif</strong> untuk menjaga keutuhan riwayat transaksi.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Ya, Hapus Produk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: Hapus Masal Produk Terpilih */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus {selectedProductIds.length} Produk Terpilih?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 py-2">
              Apakah Anda yakin ingin menghapus <strong className="text-slate-900">{selectedProductIds.length} produk</strong> yang diceklis dari sistem?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl mb-4 border border-slate-200">
              Catatan: Riwayat produk pada faktur invoice terdahulu tetap dipertahankan demi keutuhan data transaksi.
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
                    <span>Ya, Hapus {selectedProductIds.length} Produk</span>
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
