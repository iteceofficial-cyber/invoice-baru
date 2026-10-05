import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  Palette,
  Save,
  CreditCard,
  Lock,
  MessageSquare,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { ChangePasswordView } from './ChangePasswordView.tsx';
import { PaymentMethodItem, DEFAULT_WHATSAPP_TEMPLATE, DEFAULT_PAYMENT_METHODS } from '../lib/pdfGenerator.ts';

interface CompanySettings {
  company_name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bank_account_no: string;
  bank_name: string;
  bank_account_name: string;
}

interface InvoiceSettings {
  prefix: string;
  number_format: string;
  start_number: number;
  date_format: string;
  currency: string;
  default_tax_percent: number;
  default_discount: number;
  default_notes: string;
  signature_text: string;
  signer_name: string;
  signer_title: string;
  footer_text: string;
  primary_color: string;
  secondary_color: string;
  app_name: string;
  header_image_url: string;
  footer_image_url: string;
  whatsapp_template?: string;
  payment_methods?: PaymentMethodItem[];
}

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role_name === 'Super Admin' || user?.role_id === 1;

  const [activeTab, setActiveTab] = useState<'company' | 'payment' | 'whatsapp' | 'invoice' | 'branding' | 'security'>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState<CompanySettings>({
    company_name: '',
    logo_url: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    bank_account_no: '',
    bank_name: '',
    bank_account_name: '',
  });

  const [invoice, setInvoice] = useState<InvoiceSettings>({
    prefix: 'INV',
    number_format: 'INV/{YYYY}/{MM}/{NUMBER}',
    start_number: 1,
    date_format: 'DD/MM/YYYY',
    currency: 'IDR',
    default_tax_percent: 11,
    default_discount: 0,
    default_notes: '',
    signature_text: 'Hormat Kami,',
    signer_name: 'Mohamad Rizal',
    signer_title: 'Direktur Operasional Info Papandayan',
    footer_text: '',
    primary_color: '#136239',
    secondary_color: '#7ba892',
    app_name: 'Info Papandayan - Invoice & Logistik',
    header_image_url: '/invoice-header.svg',
    footer_image_url: '/invoice-footer.svg',
  });

  // Multiple payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);

  // WhatsApp template state
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(DEFAULT_WHATSAPP_TEMPLATE);

  const toast = useToast();

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setLoading(true);
    const compRes = await apiRequest('/api/settings/company');
    if (compRes.success && compRes.data) {
      setCompany(compRes.data);
    }

    const invRes = await apiRequest('/api/settings/invoice');
    if (invRes.success && invRes.data) {
      const data = invRes.data;
      setInvoice({
        ...data,
        header_image_url: data.header_image_url || '/invoice-header.svg',
        footer_image_url: data.footer_image_url || '/invoice-footer.svg',
        primary_color: data.primary_color || '#136239',
        secondary_color: data.secondary_color || '#7ba892',
      });

      if (data.whatsapp_template) {
        setWhatsappTemplate(data.whatsapp_template);
      } else {
        setWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE);
      }

      if (Array.isArray(data.payment_methods) && data.payment_methods.length > 0) {
        setPaymentMethods(data.payment_methods);
      } else {
        setPaymentMethods(DEFAULT_PAYMENT_METHODS);
      }
    }
    setLoading(false);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/api/settings/company', {
      method: 'PUT',
      body: JSON.stringify(company),
    });
    setSaving(false);

    if (res.success) {
      toast.success('Pengaturan profil perusahaan berhasil disimpan!');
    } else {
      toast.error(res.message || 'Gagal menyimpan profil perusahaan');
    }
  };

  const handleSaveInvoiceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/api/settings/invoice', {
      method: 'PUT',
      body: JSON.stringify({
        ...invoice,
        payment_methods: paymentMethods,
        whatsapp_template: whatsappTemplate,
      }),
    });
    setSaving(false);

    if (res.success) {
      toast.success('Pengaturan invoice dan penomoran berhasil disimpan!');
    } else {
      toast.error(res.message || 'Gagal menyimpan pengaturan invoice');
    }
  };

  // Payment Methods Handlers
  const handleTogglePaymentMethod = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_active: !m.is_active } : m))
    );
  };

  const handleUpdatePaymentMethod = (id: string, field: keyof PaymentMethodItem, value: any) => {
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleAddPaymentMethod = () => {
    const newId = 'pm-' + Date.now();
    const newMethod: PaymentMethodItem = {
      id: newId,
      name: 'Bank Baru',
      category: 'bank',
      account_no: '',
      account_name: company.company_name || 'Info Papandayan',
      notes: '',
      is_active: true,
    };
    setPaymentMethods([...paymentMethods, newMethod]);
    toast.info('Baris metode pembayaran baru ditambahkan. Silakan isi detail rekening dan klik Simpan.');
  };

  const handleDeletePaymentMethod = (id: string) => {
    if (paymentMethods.length <= 1) {
      toast.warning('Minimal harus ada 1 metode pembayaran terdaftar di sistem');
      return;
    }
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
    toast.info('Metode pembayaran dihapus');
  };

  const handleSavePaymentMethods = async () => {
    setSaving(true);
    const res = await apiRequest('/api/settings/invoice', {
      method: 'PUT',
      body: JSON.stringify({
        ...invoice,
        payment_methods: paymentMethods,
      }),
    });
    setSaving(false);

    if (res.success) {
      toast.success('Daftar metode pembayaran berhasil diperbarui!');
    } else {
      toast.error(res.message || 'Gagal menyimpan metode pembayaran');
    }
  };

  // WhatsApp Template Handlers
  const handleInsertPlaceholder = (tag: string) => {
    setWhatsappTemplate((prev) => prev + tag);
    toast.info(`Placeholder ${tag} ditambahkan ke template`);
  };

  const handleResetWhatsAppTemplate = () => {
    setWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE);
    toast.info('Template pesan WhatsApp direset ke standar resmi');
  };

  const handleSaveWhatsAppTemplate = async () => {
    setSaving(true);
    const res = await apiRequest('/api/settings/invoice', {
      method: 'PUT',
      body: JSON.stringify({
        ...invoice,
        whatsapp_template: whatsappTemplate,
      }),
    });
    setSaving(false);

    if (res.success) {
      toast.success('Template pesan WhatsApp pelanggan berhasil disimpan!');
    } else {
      toast.error(res.message || 'Gagal menyimpan template WhatsApp');
    }
  };

  // Generate live sample preview for WhatsApp template
  const sampleActiveMethodsText = paymentMethods
    .filter((m) => m.is_active)
    .map((m) => {
      if (m.category === 'cash') return `• *${m.name}*: ${m.notes || 'Pembayaran langsung di kasir kantor'}`;
      if (m.category === 'qris') return `• *${m.name}* (${m.account_name}): ${m.account_no}${m.notes ? ` - ${m.notes}` : ''}`;
      return `• *${m.name}*: ${m.account_no} (a.n. ${m.account_name})${m.notes ? ` - ${m.notes}` : ''}`;
    })
    .join('\n') || '• Bank Mandiri: 131-00-1849201-8 (a.n. Info Papandayan)';

  const sampleLivePreview = whatsappTemplate
    .replace(/\{nomor_invoice\}/g, 'INV/2026/10/0001')
    .replace(/\{nama_pelanggan\}/g, 'PT Megah Karya Nusantara')
    .replace(/\{tanggal\}/g, '05 Oktober 2026')
    .replace(/\{jatuh_tempo\}/g, '19 Oktober 2026')
    .replace(/\{total\}/g, 'Rp 12.500.000')
    .replace(/\{status\}/g, 'MENUNGGU PEMBAYARAN')
    .replace(
      /\{rincian_barang\}/g,
      '  1. Paket Wisata Sunrise Kawah Papandayan (10 Pax) = Rp 7.500.000\n  2. Sewa Peralatan Camping & Tenda Dome (5 Set) = Rp 5.000.000'
    )
    .replace(/\{metode_pembayaran\}/g, sampleActiveMethodsText)
    .replace(
      /\{link_download\}/g,
      typeof window !== 'undefined'
        ? `${window.location.origin}/?inv=INV%2F2026%2F10%2F0001`
        : 'https://ais-applet.run.app/?inv=INV%2F2026%2F10%2F0001'
    )
    .replace(/\{catatan\}/g, '📝 *Catatan:* Pembayaran mohon dikonfirmasi maksimal H-2 kegiatan.')
    .replace(/\{nama_perusahaan\}/g, company.company_name || 'Info Papandayan')
    .replace(/\{telepon_perusahaan\}/g, company.phone || '+62 822-4063-0123')
    .replace(/\{website_perusahaan\}/g, company.website || 'https://infopapandayan.com');

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-xl" />
        <div className="h-96 bg-white rounded-2xl border border-slate-200" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Pengaturan Sistem & Administrasi Info Papandayan
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Kelola profil usaha, multi-metode pembayaran yang dapat diceklis, template pesan WhatsApp pelanggan, dan format nomor faktur
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px custom-scrollbar">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'company'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Profil Usaha & Kontak</span>
        </button>

        <button
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'payment'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Metode Pembayaran (Ceklis)</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'whatsapp'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Pesan WhatsApp Pelanggan</span>
        </button>

        <button
          onClick={() => setActiveTab('invoice')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'invoice'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Format & Penomoran Invoice</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'branding'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Warna & Penandatangan</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'security'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Ganti Password</span>
        </button>
      </div>

      {/* TAB 1: Company Profile */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Identitas Usaha & Kontak Resmi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data ini tampil pada dokumen faktur, rincian kontak klien, dan tagihan
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nama Perusahaan / Organisasi *
              </label>
              <input
                type="text"
                value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                placeholder="Contoh: Info Papandayan"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-[#136239] focus:bg-white"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Alamat Kantor Lengkap
              </label>
              <textarea
                rows={2}
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                placeholder="Alamat kantor resmi..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="text"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                placeholder="+62 822-4063-0123 / +62 813-2127-3552"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Perusahaan
              </label>
              <input
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                placeholder="info@infopapandayan.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239] focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Website / Tautan Resmi
              </label>
              <input
                type="text"
                value={company.website}
                onChange={(e) => setCompany({ ...company, website: e.target.value })}
                placeholder="https://infopapandayan.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239] focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Multiple Payment Methods (Checkboxes) */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#136239]" />
                <span>Pengaturan Metode Pembayaran Resmi</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ceklis (centang) metode pembayaran yang ingin diaktifkan dan ditampilkan pada cetak faktur invoice, link publik, dan pesan WhatsApp
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPaymentMethod}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#136239] text-xs font-bold transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekening / Metode</span>
            </button>
          </div>

          <div className="space-y-4">
            {paymentMethods.map((method, idx) => (
              <div
                key={method.id || idx}
                className={`p-4 rounded-2xl border transition ${
                  method.is_active
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/60 opacity-80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <label className="relative flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={method.is_active}
                        onChange={() => handleTogglePaymentMethod(method.id)}
                        className="w-5 h-5 rounded-lg accent-[#136239] border-slate-300 cursor-pointer"
                      />
                      <span className="font-bold text-sm text-slate-900">
                        {method.is_active ? 'Aktif (Tampil di Invoice & WA)' : 'Nonaktif (Disembunyikan)'}
                      </span>
                    </label>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        method.category === 'qris'
                          ? 'bg-purple-100 text-purple-800'
                          : method.category === 'cash'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {method.category === 'qris' ? 'QRIS' : method.category === 'cash' ? 'Tunai / Kasir' : 'Transfer Bank'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeletePaymentMethod(method.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer self-end sm:self-auto"
                    title="Hapus metode ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Nama Metode / Bank
                    </label>
                    <input
                      type="text"
                      value={method.name}
                      onChange={(e) => handleUpdatePaymentMethod(method.id, 'name', e.target.value)}
                      placeholder="Contoh: Bank BCA, Bank Mandiri, QRIS"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#136239]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Nomor Rekening / NMID
                    </label>
                    <input
                      type="text"
                      value={method.account_no}
                      onChange={(e) => handleUpdatePaymentMethod(method.id, 'account_no', e.target.value)}
                      placeholder="131-00-1849201-8"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#136239]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Atas Nama Rekening
                    </label>
                    <input
                      type="text"
                      value={method.account_name}
                      onChange={(e) => handleUpdatePaymentMethod(method.id, 'account_name', e.target.value)}
                      placeholder="Info Papandayan"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#136239]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Catatan / KCP / Deskripsi
                    </label>
                    <input
                      type="text"
                      value={method.notes || ''}
                      onChange={(e) => handleUpdatePaymentMethod(method.id, 'notes', e.target.value)}
                      placeholder="KCP Garut, Scan QRIS, dll"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 focus:ring-2 focus:ring-[#136239]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Metode pembayaran yang diceklis akan otomatis disertakan pada placeholder <code>{'{metode_pembayaran}'}</code> di pesan WhatsApp dan PDF invoice.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={handleSavePaymentMethods}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Metode Pembayaran'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: WhatsApp Message Template */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <span>Format Template Pesan WhatsApp Pelanggan</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan kata-kata pesan resmi saat tombol "Kirim via WhatsApp" diklik. Mendukung variabel otomatis dan link download invoice.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetWhatsAppTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ke Standar</span>
            </button>
          </div>

          {/* Variable Chips */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-[#136239]" />
              <span>Klik Variabel untuk Menyisipkan ke Pesan:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { tag: '{nomor_invoice}', label: 'No. Invoice' },
                { tag: '{nama_pelanggan}', label: 'Nama Pelanggan' },
                { tag: '{tanggal}', label: 'Tanggal Invoice' },
                { tag: '{jatuh_tempo}', label: 'Jatuh Tempo' },
                { tag: '{total}', label: 'Total Tagihan' },
                { tag: '{status}', label: 'Status Tagihan' },
                { tag: '{rincian_barang}', label: 'Daftar Barang & Qty' },
                { tag: '{metode_pembayaran}', label: 'Rekening & Metode Pembayaran' },
                { tag: '{link_download}', label: 'Link Unduh / Download PDF' },
                { tag: '{catatan}', label: 'Catatan Faktur' },
                { tag: '{nama_perusahaan}', label: 'Nama Perusahaan' },
                { tag: '{telepon_perusahaan}', label: 'No. Telepon' },
                { tag: '{website_perusahaan}', label: 'Website' },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleInsertPlaceholder(item.tag)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-[11px] font-mono font-semibold text-slate-700 transition cursor-pointer"
                >
                  <span className="text-[#136239] font-bold">{item.tag}</span>
                  <span className="text-slate-400 ml-1">({item.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template Editor & Live WhatsApp Bubble Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Editor Template Pesan WhatsApp
              </label>
              <textarea
                rows={16}
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 leading-relaxed focus:bg-white focus:ring-2 focus:ring-[#136239] custom-scrollbar shadow-inner"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Gunakan format WhatsApp seperti <code>*teks tebal*</code>, <code>_teks miring_</code>, atau baris baru sesuai keinginan.
              </p>
            </div>

            {/* Live Preview Bubble */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Pratinjau Pesan yang Diterima Pelanggan:</span>
                <span className="text-[11px] text-emerald-600 font-bold lowercase">live preview</span>
              </label>
              <div className="bg-[#e5ddd5] p-4 rounded-2xl border border-slate-300 min-h-[360px] flex flex-col justify-between">
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-md border border-slate-200/60 max-w-full space-y-2">
                  <p className="whitespace-pre-line text-xs text-slate-900 font-sans leading-relaxed break-words">
                    {sampleLivePreview}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                    <span>10:30 AM</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>

                <div className="pt-3 text-center">
                  <span className="text-[10px] text-slate-600 bg-white/70 px-2 py-0.5 rounded-full">
                    Contoh simulasi teks yang akan otomatis terisi saat pengiriman ke WhatsApp pelanggan
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveWhatsAppTemplate}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Template WhatsApp'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Invoice Format & Numbering */}
      {activeTab === 'invoice' && (
        <form onSubmit={handleSaveInvoiceSettings} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Format & Penomoran Otomatis Invoice</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sesuaikan pola nomor faktur, persentase pajak default, dan syarat ketentuan
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Prefix Invoice
              </label>
              <input
                type="text"
                value={invoice.prefix}
                onChange={(e) => setInvoice({ ...invoice, prefix: e.target.value })}
                placeholder="INV"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm uppercase focus:ring-2 focus:ring-[#136239]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Pola / Format Nomor Faktur
              </label>
              <input
                type="text"
                value={invoice.number_format}
                onChange={(e) => setInvoice({ ...invoice, number_format: e.target.value })}
                placeholder="INV/{YYYY}/{MM}/{NUMBER}"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm focus:ring-2 focus:ring-[#136239]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Placeholder tersedia: <code>{'{YYYY}'}</code> (Tahun), <code>{'{MM}'}</code> (Bulan), <code>{'{DD}'}</code> (Hari), <code>{'{NUMBER}'}</code> (Urutan 4 digit)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nomor Awal / Counter
              </label>
              <input
                type="number"
                min="1"
                value={invoice.start_number}
                onChange={(e) => setInvoice({ ...invoice, start_number: parseInt(e.target.value) || 1 })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Mata Uang
              </label>
              <input
                type="text"
                value={invoice.currency}
                onChange={(e) => setInvoice({ ...invoice, currency: e.target.value })}
                placeholder="IDR (Rp)"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-[#136239]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default PPN / Pajak (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={invoice.default_tax_percent}
                onChange={(e) => setInvoice({ ...invoice, default_tax_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-[#136239]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Catatan & Syarat Default Invoice
            </label>
            <textarea
              rows={4}
              value={invoice.default_notes}
              onChange={(e) => setInvoice({ ...invoice, default_notes: e.target.value })}
              placeholder="Contoh instruksi pembayaran default..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239]"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Format Invoice'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: Branding & Custom Header/Footer */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveInvoiceSettings} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Branding, Warna, & Penandatangan</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur nama aplikasi, penandatangan resmi, dan kop surat (header & footer)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nama Aplikasi di Header
              </label>
              <input
                type="text"
                value={invoice.app_name}
                onChange={(e) => setInvoice({ ...invoice, app_name: e.target.value })}
                placeholder="Info Papandayan - Invoice & Logistik"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold focus:ring-2 focus:ring-[#136239]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Teks Salam Penutup
              </label>
              <input
                type="text"
                value={invoice.signature_text}
                onChange={(e) => setInvoice({ ...invoice, signature_text: e.target.value })}
                placeholder="Hormat Kami,"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nama Penandatangan
              </label>
              <input
                type="text"
                value={invoice.signer_name}
                onChange={(e) => setInvoice({ ...invoice, signer_name: e.target.value })}
                placeholder="Mohamad Rizal"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-[#136239]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Jabatan Penandatangan
              </label>
              <input
                type="text"
                value={invoice.signer_title}
                onChange={(e) => setInvoice({ ...invoice, signer_title: e.target.value })}
                placeholder="Direktur Operasional Info Papandayan"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#136239]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Warna & Penandatangan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 6: Security / Change Password */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
          <ChangePasswordView />
        </div>
      )}
    </div>
  );
};
