import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Search,
  Eye,
  Save,
  CheckCircle2,
  Calendar,
  Building2,
  User,
  Calculator,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, terbilang } from '../lib/utils.ts';
import { useToast } from '../context/ToastContext.tsx';
import { InvoicePreviewModal } from './InvoicePreviewModal.tsx';
import { NavTab } from '../components/Sidebar.tsx';
import { generateInvoicePDF, InvoicePDFData } from '../lib/pdfGenerator.ts';

interface InvoiceItemForm {
  id?: number;
  product_id?: number | null;
  product_code: string;
  product_name: string;
  qty: number;
  unit: string;
  price: number;
  subtotal: number;
  stock?: number;
}

interface CustomerOption {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface ProductOption {
  id: number;
  code: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
}

interface CreateInvoiceViewProps {
  onNavigate: (tab: NavTab) => void;
  editInvoiceId?: number | null;
  onClearEdit?: () => void;
}

export const CreateInvoiceView: React.FC<CreateInvoiceViewProps> = ({
  onNavigate,
  editInvoiceId,
  onClearEdit,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  // Customer
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saveNewCustomerToDb, setSaveNewCustomerToDb] = useState(false);

  // Bank & Settings
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('paid');

  // Calculations
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountRate, setDiscountRate] = useState<number>(0);

  // Items
  const [items, setItems] = useState<InvoiceItemForm[]>([]);

  // Products available in db
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Settings & Company loaded from db
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  // Load initial settings and options
  useEffect(() => {
    loadPrerequisites();
  }, [editInvoiceId]);

  const loadPrerequisites = async () => {
    // 1. Customers
    const custRes = await apiRequest('/api/customers?all=true');
    if (custRes.success && custRes.data) {
      setCustomers(custRes.data);
    }

    // 2. Products
    const prodRes = await apiRequest('/api/products?limit=100&status=active');
    if (prodRes.success && prodRes.data) {
      setProducts(prodRes.data);
    }

    // 3. Settings
    const compRes = await apiRequest('/api/settings/company');
    if (compRes.success && compRes.data) {
      setCompanySettings(compRes.data);
      setBankName(compRes.data.bank_name || '');
      setBankAccountNo(compRes.data.bank_account_no || '');
      setBankAccountName(compRes.data.bank_account_name || '');
    }

    const setRes = await apiRequest('/api/settings/invoice');
    if (setRes.success && setRes.data) {
      setInvoiceSettings(setRes.data);
      setNotes(setRes.data.default_notes || '');
    }

    // If Editing existing invoice
    if (editInvoiceId) {
      const invRes = await apiRequest(`/api/invoices/${editInvoiceId}`);
      if (invRes.success && invRes.data) {
        const inv = invRes.data;
        setInvoiceNumber(inv.invoice_number);
        setCustomerName(inv.customer_name);
        setSelectedCustomerId(inv.customer_id ? inv.customer_id.toString() : '');
        setCustomerAddress(inv.customer_address || '');
        setCustomerPhone(inv.customer_phone || '');
        setActivityDate(inv.activity_date);
        setBankName(inv.bank_name || '');
        setBankAccountNo(inv.bank_account_no || '');
        setBankAccountName(inv.bank_account_name || '');
        setNotes(inv.notes || '');
        setStatus(inv.status);
        setDiscountType(inv.discount_type || 'fixed');
        setDiscountRate(inv.discount_rate || 0);

        setItems(
          inv.items.map((it: any) => ({
            id: it.id,
            product_id: it.product_id,
            product_code: it.product_code,
            product_name: it.product_name,
            qty: it.qty,
            unit: it.unit,
            price: it.price,
            subtotal: it.subtotal,
            stock: it.current_product_stock,
          }))
        );
        return;
      }
    }

    // New invoice: generate next invoice number
    const nextNumRes = await apiRequest('/api/invoices/next-number');
    if (nextNumRes.success && nextNumRes.invoiceNumber) {
      setInvoiceNumber(nextNumRes.invoiceNumber);
    }

    // Default item
    setItems([
      {
        product_id: null,
        product_code: '',
        product_name: '',
        qty: 1,
        unit: 'Pcs',
        price: 0,
        subtotal: 0,
      },
    ]);
  };

  // Customer dropdown selection
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    if (!custId) {
      setCustomerName('');
      setCustomerAddress('');
      setCustomerPhone('');
      return;
    }

    const c = customers.find((cust) => cust.id.toString() === custId);
    if (c) {
      setCustomerName(c.name);
      setCustomerAddress(c.address || '');
      setCustomerPhone(c.phone || '');
    }
  };

  // Product selection in item row
  const handleProductSelect = (index: number, prodIdStr: string) => {
    const updated = [...items];
    if (!prodIdStr) {
      updated[index] = {
        ...updated[index],
        product_id: null,
        product_code: '',
        product_name: '',
        unit: 'Pcs',
        price: 0,
        subtotal: 0,
      };
      setItems(updated);
      return;
    }

    const p = products.find((prod) => prod.id.toString() === prodIdStr);
    if (p) {
      const sub = updated[index].qty * p.price;
      updated[index] = {
        ...updated[index],
        product_id: p.id,
        product_code: p.code,
        product_name: p.name,
        unit: p.unit,
        price: p.price,
        stock: p.stock,
        subtotal: sub,
      };
      setItems(updated);
    }
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceItemForm, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    if (field === 'qty' || field === 'price') {
      const q = field === 'qty' ? parseInt(value) || 0 : current.qty;
      const p = field === 'price' ? parseFloat(value) || 0 : current.price;
      current.subtotal = q * p;
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        product_id: null,
        product_code: '',
        product_name: '',
        qty: 1,
        unit: 'Pcs',
        price: 0,
        subtotal: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning('Invoice minimal memiliki 1 item barang');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Calculations (Pajak PPN dihilangkan)
  const subtotal = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round((subtotal * discountRate) / 100);
  } else {
    discountAmount = Math.min(subtotal, discountRate);
  }
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const grandTotal = afterDiscount;

  // Validation
  const validateForm = () => {
    if (!invoiceNumber.trim()) {
      toast.error('Nomor invoice wajib diisi');
      return false;
    }
    if (!customerName.trim()) {
      toast.error('Nama pelanggan/penerima invoice wajib diisi');
      return false;
    }
    if (!activityDate) {
      toast.error('Tanggal kegiatan wajib diisi');
      return false;
    }
    if (items.length === 0) {
      toast.error('Invoice harus memiliki minimal 1 barang');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.product_name.trim()) {
        toast.error(`Baris ${i + 1}: Nama barang tidak boleh kosong`);
        return false;
      }
      if (it.qty <= 0) {
        toast.error(`Baris ${i + 1}: Jumlah/Qty harus lebih dari 0`);
        return false;
      }
    }
    return true;
  };

  const handleSaveInvoice = async (andPrint = false) => {
    if (!validateForm()) return;

    setSaving(true);

    let finalCustomerId: number | null = selectedCustomerId ? parseInt(selectedCustomerId) : null;

    // If manual customer input and checkbox is active, register them to database
    if (!finalCustomerId && customerName.trim() && saveNewCustomerToDb) {
      try {
        const createCustRes = await apiRequest('/api/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: customerName.trim(),
            address: customerAddress.trim(),
            phone: customerPhone.trim(),
            email: '',
            notes: 'Ditambahkan otomatis dari form invoice ' + invoiceNumber.trim(),
          }),
        });
        if (createCustRes.success && createCustRes.data?.id) {
          finalCustomerId = createCustRes.data.id;
        }
      } catch {
        // proceed
      }
    }

    const payload = {
      invoice_number: invoiceNumber.trim(),
      customer_id: finalCustomerId,
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim(),
      customer_phone: customerPhone.trim(),
      activity_date: activityDate,
      due_date: activityDate,
      bank_account_no: bankAccountNo.trim(),
      bank_name: bankName.trim(),
      bank_account_name: bankAccountName.trim(),
      notes: notes.trim(),
      discount_type: discountType,
      discount_rate: discountRate,
      tax_percent: 0,
      status,
      items: items.map((it) => ({
        product_id: it.product_id,
        product_code: it.product_code || '',
        product_name: it.product_name,
        qty: it.qty,
        unit: it.unit || 'Pcs',
        price: it.price,
      })),
    };

    let res;
    if (editInvoiceId) {
      res = await apiRequest(`/api/invoices/${editInvoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiRequest('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);

    if (res.success) {
      toast.success(editInvoiceId ? 'Invoice berhasil diperbarui' : 'Invoice baru berhasil disimpan!');

      if (andPrint) {
        // Trigger print immediately
        const pdfData = getPreviewData();
        generateInvoicePDF(pdfData, 'print');
      }

      if (onClearEdit) onClearEdit();
      onNavigate('invoices');
    } else {
      toast.error(res.message || 'Gagal menyimpan invoice');
    }
  };

  const getPreviewData = (): InvoicePDFData => {
    return {
      id: editInvoiceId || undefined,
      invoice_number: invoiceNumber.trim() || 'INV/DRAFT',
      customer_name: customerName.trim() || 'Nama Pelanggan',
      customer_address: customerAddress.trim(),
      customer_phone: customerPhone.trim(),
      activity_date: activityDate || new Date().toISOString().split('T')[0],
      due_date: undefined,
      bank_account_no: bankAccountNo,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      notes,
      subtotal,
      discount_amount: discountAmount,
      tax_percent: 0,
      tax_amount: 0,
      total_amount: grandTotal,
      status,
      items: items.map((it) => ({
        product_code: it.product_code || '',
        product_name: it.product_name || 'Barang',
        qty: it.qty || 1,
        unit: it.unit || 'Pcs',
        price: it.price || 0,
        subtotal: it.subtotal || 0,
      })),
      company: companySettings,
      settings: invoiceSettings,
      payment_methods: invoiceSettings?.payment_methods
        ? typeof invoiceSettings.payment_methods === 'string'
          ? (() => {
              try {
                return JSON.parse(invoiceSettings.payment_methods);
              } catch {
                return undefined;
              }
            })()
          : invoiceSettings.payment_methods
        : undefined,
    };
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {editInvoiceId ? `Edit Invoice: ${invoiceNumber}` : 'Buat Invoice Baru'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Lengkapi data tagihan klien, pilih produk dari database, dan cetak faktur A4 profesional
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/70 text-[#136239] text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#136239]" />
            <span>Pratinjau / Preview A4</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveInvoice(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Invoice'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left: Invoice Details Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Header Metadata & Customer */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              1. Informasi Pelanggan & Metadata Faktur
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor Invoice *
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Contoh: INV/2026/10/0001"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              {/* Activity Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tanggal Kegiatan *
                </label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Customer Picker & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Data Pelanggan Terdaftar
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="">-- Pilih dari database atau ketik manual --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Penerima Invoice *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama instansi, PT, CV, atau perorangan"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
                {!selectedCustomerId && customerName.trim() && (
                  <div className="flex items-center gap-1.5 pt-1.5">
                    <input
                      type="checkbox"
                      id="saveNewCustomerCheckbox"
                      checked={saveNewCustomerToDb}
                      onChange={(e) => setSaveNewCustomerToDb(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#136239] border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="saveNewCustomerCheckbox" className="text-[11px] text-slate-600 font-medium cursor-pointer">
                      Simpan ke database pelanggan
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Status Invoice
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#136239] focus:bg-white"
                >
                  <option value="paid">Lunas (Paid)</option>
                  <option value="pending">Menunggu Pembayaran (Pending)</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Additional Customer Details: Phone & Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor WhatsApp Pelanggan (Untuk Kirim Invoice)
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Contoh: 08123456789 atau 628123456789"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Pelanggan
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Alamat penagihan atau pengiriman"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Items Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                2. Daftar Barang / Produk Transaksi ({items.length} item)
              </h3>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 hover:border-blue-200 transition"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1">
                    <span>Barang #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                      title="Hapus baris ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Database product selector */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                        Pilih Produk Dari Stok
                      </label>
                      <select
                        value={it.product_id ? it.product_id.toString() : ''}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih dari database --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stok: {p.stock})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product Name (editable) */}
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                        Deskripsi / Nama Barang *
                      </label>
                      <input
                        type="text"
                        value={it.product_name}
                        onChange={(e) => handleUpdateItem(idx, 'product_name', e.target.value)}
                        placeholder="Nama spesifikasi barang"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end pt-1">
                    {/* Qty */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                        Qty *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-center focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Unit */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                        Satuan
                      </label>
                      <input
                        type="text"
                        value={it.unit}
                        onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                        placeholder="Pcs"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-center focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Price */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                        Harga Satuan (Rp) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={it.price}
                        onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-right focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="sm:col-span-3 text-right">
                      <span className="block text-[10px] text-slate-400 font-semibold mb-1">
                        Subtotal
                      </span>
                      <span className="font-bold text-xs text-slate-900 block py-1.5">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 text-blue-600 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Baris Barang Lagi</span>
            </button>
          </div>
        </div>

        {/* Right Sidebar: Calculations, Bank & Final Actions */}
        <div className="space-y-6">
          {/* Card: Calculations Summary */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Ringkasan Perhitungan Tagihan
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Subtotal Barang:</span>
                <span className="font-bold text-slate-900 text-sm">{formatRupiah(subtotal)}</span>
              </div>

              {/* Discount inputs */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Potongan Diskon:</span>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-0.5 font-bold ${
                        discountType === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      Rp
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 font-bold ${
                        discountType === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-xs"
                  />
                  <span className="text-rose-600 font-bold shrink-0">
                    - {formatRupiah(discountAmount)}
                  </span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200 text-slate-900 space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#136239] block">
                  Total Tagihan (Grand Total)
                </span>
                <p className="text-2xl font-extrabold text-[#136239] tracking-tight">
                  {formatRupiah(grandTotal)}
                </p>
              </div>

              {/* Live Terbilang preview */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Terbilang Otomatis:
                </span>
                <p className="text-xs font-semibold italic text-[#136239] leading-snug">
                  "{terbilang(grandTotal)}"
                </p>
              </div>
            </div>

            {/* Bank details input */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Informasi Rekening Pembayaran
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Nama Bank (misal: Bank Mandiri)"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium"
              />
              <input
                type="text"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                placeholder="Nomor Rekening"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-bold"
              />
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="Atas Nama Rekening"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
              />
            </div>

            {/* Notes */}
            <div className="pt-2 text-xs">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Catatan / Instruksi Invoice
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instruksi transfer, batas tempo, atau berita tagihan"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs"
              />
            </div>

            {/* Submit Buttons */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveInvoice(false)}
                className="w-full py-3 px-4 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white font-bold text-xs shadow-md shadow-emerald-950/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Sedang Menyimpan...' : 'Simpan Invoice'}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveInvoice(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#136239] font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-[#136239]" />
                <span>Simpan & Cetak Langsung</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <InvoicePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          data={getPreviewData()}
        />
      )}
    </div>
  );
};
