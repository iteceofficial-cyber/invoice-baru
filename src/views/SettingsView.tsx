import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  Upload,
  Eye,
  RefreshCw,
  Globe,
  Link2,
  Cloud,
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
  public_app_url?: string;
}

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role_name === 'Super Admin' || user?.role_id === 1;

  const [activeTab, setActiveTab] = useState<
    'company' | 'header-footer' | 'payment' | 'whatsapp' | 'invoice' | 'branding' | 'security' | 'cloud'
  >('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ active: boolean; message: string }>({
    active: true,
    message: 'Tersambung ke Cloud Firestore',
  });

  const checkCloudStatus = async () => {
    try {
      const res = await apiRequest('/api/system/cloud-status');
      if (res.success) {
        setCloudStatus({
          active: res.cloud_active,
          message: res.message || 'Cloud Firestore Aktif',
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkCloudStatus();
  }, []);

  const handleManualSync = async () => {
    setSyncingCloud(true);
    const res = await apiRequest('/api/system/sync-cloud', { method: 'POST' });
    setSyncingCloud(false);
    if (res.success) {
      toast.success('Basis data berhasil disinkronkan ke Cloud Firestore!');
    } else {
      toast.error(res.message || 'Gagal sinkronisasi cloud');
    }
  };

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
    public_app_url: '',
  });

  // Multiple payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);

  // WhatsApp template state
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(DEFAULT_WHATSAPP_TEMPLATE);

  const toast = useToast();
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const footerFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File | undefined, type: 'header' | 'footer') => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.name.endsWith('.svg')) {
      toast.error('File harus berformat gambar (.png, .jpg, .jpeg, .svg, .webp)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        toast.error('Gagal membaca file gambar');
        return;
      }

      // If SVG, process directly
      if (file.name.endsWith('.svg') || file.type.includes('svg')) {
        if (type === 'header') {
          setInvoice((prev) => ({ ...prev, header_image_url: dataUrl }));
          toast.success('Gambar Kop Header SVG berhasil dimuat! Klik "Simpan Kop Header & Footer" untuk menerapkan.');
        } else {
          setInvoice((prev) => ({ ...prev, footer_image_url: dataUrl }));
          toast.success('Gambar Kop Footer SVG berhasil dimuat! Klik "Simpan Kop Header & Footer" untuk menerapkan.');
        }
        return;
      }

      // For raster images (PNG, JPG, WEBP), downscale large images safely for letterhead ratio
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 1200;
          const maxH = 320;
          let targetW = img.width;
          let targetH = img.height;

          if (targetW > maxW || targetH > maxH) {
            const ratio = Math.min(maxW / targetW, maxH / targetH);
            targetW = Math.round(targetW * ratio);
            targetH = Math.round(targetH * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill clean white background first to prevent black boxes on transparent PNGs
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
            if (type === 'header') {
              setInvoice((prev) => ({ ...prev, header_image_url: optimizedDataUrl }));
              toast.success(`Gambar Kop Header (${targetW}x${targetH}px) siap! Klik "Simpan Kop Header & Footer".`);
            } else {
              setInvoice((prev) => ({ ...prev, footer_image_url: optimizedDataUrl }));
              toast.success(`Gambar Kop Footer (${targetW}x${targetH}px) siap! Klik "Simpan Kop Header & Footer".`);
            }
          } else {
            if (type === 'header') {
              setInvoice((prev) => ({ ...prev, header_image_url: dataUrl }));
            } else {
              setInvoice((prev) => ({ ...prev, footer_image_url: dataUrl }));
            }
          }
        } catch {
          if (type === 'header') {
            setInvoice((prev) => ({ ...prev, header_image_url: dataUrl }));
          } else {
            setInvoice((prev) => ({ ...prev, footer_image_url: dataUrl }));
          }
        }
      };
      img.onerror = () => {
        toast.error('File gambar tidak dapat dibaca atau rusak. Silakan pilih gambar yang valid.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      toast.error('Gagal membaca data dari perangkat');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveHeaderFooter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/api/settings/header-footer', {
      method: 'PUT',
      body: JSON.stringify({
        header_image_url: invoice.header_image_url,
        footer_image_url: invoice.footer_image_url,
        footer_text: invoice.footer_text,
        company_name: company.company_name,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
      }),
    });
    setSaving(false);

    if (res.success) {
      toast.success('Kop Header & Footer Invoice resmi berhasil disimpan secara permanen dan disinkronkan ke Cloud Firestore!');
      if (res.data) {
        setInvoice((prev) => ({
          ...prev,
          header_image_url: res.data.header_image_url || prev.header_image_url,
          footer_image_url: res.data.footer_image_url || prev.footer_image_url,
          footer_text: res.data.footer_text !== undefined ? res.data.footer_text : prev.footer_text,
        }));
        if (res.data.company) {
          setCompany(res.data.company);
        }
      }
    } else {
      toast.error(res.message || 'Gagal menyimpan Kop Header & Footer');
    }
  };

  useEffect(() => {
    loadAllSettings(true);
  }, []);

  const loadAllSettings = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const compRes = await apiRequest('/api/settings/company');
    if (compRes.success && compRes.data) {
      setCompany(compRes.data);
    }

    const invRes = await apiRequest('/api/settings/invoice');
    if (invRes.success && invRes.data) {
      const data = invRes.data;
      setInvoice({
        ...data,
        public_app_url: data.public_app_url || '',
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

      let loadedMethods: PaymentMethodItem[] = [];
      if (Array.isArray(data.payment_methods) && data.payment_methods.length > 0) {
        loadedMethods = [...data.payment_methods];
      } else if (typeof data.payment_methods === 'string') {
        try {
          const parsed = JSON.parse(data.payment_methods);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedMethods = parsed;
          }
        } catch {}
      }

      // If no payment methods loaded at all, fallback to default payment methods
      if (loadedMethods.length === 0) {
        loadedMethods = DEFAULT_PAYMENT_METHODS;
      }

      setPaymentMethods(loadedMethods);
    }
    if (isInitial) setLoading(false);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiRequest('/api/settings/company', {
      method: 'PUT',
      body: JSON.stringify({
        company_name: company.company_name,
        logo_url: company.logo_url,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
      }),
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
    setPaymentMethods((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, is_active: !m.is_active } : m));
      setInvoice((inv) => ({ ...inv, payment_methods: updated }));
      return updated;
    });
  };

  const handleUpdatePaymentMethod = (id: string, field: keyof PaymentMethodItem, value: any) => {
    setPaymentMethods((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, [field]: value } : m));
      setInvoice((inv) => ({ ...inv, payment_methods: updated }));
      return updated;
    });
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
    setPaymentMethods((prev) => {
      const updated = [...prev, newMethod];
      setInvoice((inv) => ({ ...inv, payment_methods: updated }));
      return updated;
    });
    toast.info('Baris metode pembayaran baru ditambahkan. Silakan isi detail rekening dan klik Simpan.');
  };

  const handleDeletePaymentMethod = (id: string) => {
    if (paymentMethods.length <= 1) {
      toast.warning('Minimal harus ada 1 metode pembayaran terdaftar di sistem');
      return;
    }
    setPaymentMethods((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      setInvoice((inv) => ({ ...inv, payment_methods: updated }));
      return updated;
    });
    toast.info('Metode pembayaran dihapus');
  };

  const handleRestoreDefaultPaymentMethods = () => {
    setPaymentMethods(DEFAULT_PAYMENT_METHODS);
    setInvoice((inv) => ({ ...inv, payment_methods: DEFAULT_PAYMENT_METHODS }));
    toast.info('Daftar metode pembayaran dikembalikan ke 5 pilihan standar. Klik "Simpan Metode Pembayaran" untuk menerapkan permanen.');
  };

  const handleSavePaymentMethods = async () => {
    setSaving(true);
    const res = await apiRequest('/api/settings/payment-methods', {
      method: 'PUT',
      body: JSON.stringify({
        payment_methods: paymentMethods,
      }),
    });
    setSaving(false);

    if (res.success) {
      toast.success('Daftar metode pembayaran berhasil disimpan dan disinkronkan ke Cloud Firestore!');
      const updatedList = Array.isArray(res.data) ? res.data : paymentMethods;
      setPaymentMethods(updatedList);
      setInvoice((prev) => ({ ...prev, payment_methods: updatedList }));
      // Also sync company profile state
      const compRes = await apiRequest('/api/settings/company');
      if (compRes.success && compRes.data) {
        setCompany(compRes.data);
      }
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
        payment_methods: paymentMethods,
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
      /\{link_pdf\}/g,
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/invoices/public/download-pdf?inv=INV%2F2026%2F10%2F0001&id=1`
        : 'https://ais-applet.run.app/api/invoices/public/download-pdf?inv=INV%2F2026%2F10%2F0001&id=1'
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
          onClick={() => setActiveTab('header-footer')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'header-footer'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Kop Header & Footer</span>
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

        <button
          onClick={() => setActiveTab('cloud')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'cloud'
              ? 'border-[#136239] text-[#136239]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cloud className="w-4 h-4 text-emerald-600" />
          <span>Sinkronisasi Cloud (Multi-Device)</span>
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

      {/* TAB: Kop Header & Footer Invoice */}
      {activeTab === 'header-footer' && (
        <form onSubmit={handleSaveHeaderFooter} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#136239]" />
                <span>Pengaturan Kop Header & Footer Invoice Resmi</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ubah gambar banner header kop surat atas dan footer bawah yang dicetak pada faktur invoice, unduhan PDF, dan link publik pelanggan.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Kop Header & Footer'}</span>
            </button>
          </div>

          {/* Section 1: Header Banner */}
          <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>1. Banner Kop Header (Bagian Atas Dokumen Faktur)</span>
                  <span className="text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Kop Resmi
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format banner: Gambar rasio memanjang lebar (disarankan 1200 x 310 piksel), format .PNG, .JPG, atau .SVG.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvoice((prev) => ({ ...prev, header_image_url: '/invoice-header.svg' }));
                    toast.info('Kop Header direset ke default resmi Info Papandayan');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>

            {/* Header Image Preview Box */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center justify-center min-h-[100px] overflow-hidden">
              {invoice.header_image_url ? (
                <img
                  src={invoice.header_image_url}
                  alt="Pratinjau Kop Header"
                  className="max-h-28 w-auto max-w-full object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.hasFailed) {
                      target.dataset.hasFailed = 'true';
                      target.src = '/invoice-header.svg';
                    }
                  }}
                />
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">
                  Belum ada gambar header. Menggunakan default sistem.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <input
                  type="file"
                  ref={headerFileInputRef}
                  accept=".png,.jpg,.jpeg,.svg,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'header');
                    if (headerFileInputRef.current) headerFileInputRef.current.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => headerFileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#136239]/40 bg-emerald-50/50 hover:bg-emerald-100/60 text-[#136239] text-xs font-bold transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Pilih & Unggah File Banner Header (.svg, .png, .jpg)</span>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={invoice.header_image_url}
                  onChange={(e) => setInvoice({ ...invoice, header_image_url: e.target.value })}
                  placeholder="Atau masukkan URL / path banner (contoh: /invoice-header.svg)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:ring-2 focus:ring-[#136239]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Footer Banner */}
          <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>2. Banner Kop Footer (Bagian Bawah Dokumen Faktur)</span>
                  <span className="text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Kop Resmi
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format banner: Gambar rasio memanjang lebar (disarankan 1200 x 310 piksel), format .PNG, .JPG, atau .SVG.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInvoice((prev) => ({ ...prev, footer_image_url: '/invoice-footer.svg' }));
                  toast.info('Kop Footer direset ke default resmi Info Papandayan');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
            </div>

            {/* Footer Image Preview Box */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-inner flex flex-col items-center justify-center min-h-[100px] overflow-hidden">
              {invoice.footer_image_url ? (
                <img
                  src={invoice.footer_image_url}
                  alt="Pratinjau Kop Footer"
                  className="max-h-28 w-auto max-w-full object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.hasFailed) {
                      target.dataset.hasFailed = 'true';
                      target.src = '/invoice-footer.svg';
                    }
                  }}
                />
              ) : (
                <div className="text-xs text-slate-400 py-4 text-center">
                  Belum ada gambar footer. Menggunakan default sistem.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <input
                  type="file"
                  ref={footerFileInputRef}
                  accept=".png,.jpg,.jpeg,.svg,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'footer');
                    if (footerFileInputRef.current) footerFileInputRef.current.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => footerFileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#136239]/40 bg-emerald-50/50 hover:bg-emerald-100/60 text-[#136239] text-xs font-bold transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Pilih & Unggah File Banner Footer (.svg, .png, .jpg)</span>
                </button>
              </div>

              <div>
                <input
                  type="text"
                  value={invoice.footer_image_url}
                  onChange={(e) => setInvoice({ ...invoice, footer_image_url: e.target.value })}
                  placeholder="Atau masukkan URL / path banner footer (contoh: /invoice-footer.svg)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:ring-2 focus:ring-[#136239]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Informasi Identitas Kop Surat */}
          <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#136239]" />
                <span>3. Informasi Teks Identitas Kop Surat & Kontak Usaha</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Data kontak ini dicantumkan pada header faktur, teks pengesahan, dan rincian kontak resmi perusahaan.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Perusahaan / Usaha
                </label>
                <input
                  type="text"
                  value={company.company_name}
                  onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                  placeholder="Info Papandayan"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#136239]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  placeholder="+62 822-4063-0123"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#136239]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Usaha
                </label>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  placeholder="info@infopapandayan.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:ring-2 focus:ring-[#136239]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Website Usaha
                </label>
                <input
                  type="text"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  placeholder="https://infopapandayan.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:ring-2 focus:ring-[#136239]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Lengkap Operasional Usaha
                </label>
                <input
                  type="text"
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  placeholder="Jl. Kawah Papandayan, Karamat Wangi, Cisurupan, Garut"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:ring-2 focus:ring-[#136239]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Catatan / Teks Footer */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              4. Teks Keterangan Footer / Catatan Pengesahan Dokumen
            </label>
            <textarea
              rows={2}
              value={invoice.footer_text || ''}
              onChange={(e) => setInvoice({ ...invoice, footer_text: e.target.value })}
              placeholder="Contoh: Faktur invoice resmi dan sah diproses komputerisasi Info Papandayan..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-[#136239] focus:bg-white"
            />
          </div>

          {/* Section 5: Live Invoice Letterhead Preview */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-2 text-emerald-400">
                <Eye className="w-4 h-4" />
                <span>Simulasi Tampilan Faktur A4 Resmi dengan Header & Footer Terpasang</span>
              </span>
              <span className="text-[11px] text-slate-400">Pratinjau Skala Dokumen</span>
            </div>

            <div className="bg-white text-slate-800 rounded-xl overflow-hidden shadow-2xl p-4 space-y-4 max-w-2xl mx-auto border border-slate-300">
              {/* Header preview */}
              <div className="w-full border-b border-slate-200 pb-2">
                <img
                  src={invoice.header_image_url || '/invoice-header.svg'}
                  alt="Header Preview"
                  className="w-full max-h-24 object-contain mx-auto"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.hasFailed) {
                      target.dataset.hasFailed = 'true';
                      target.src = '/invoice-header.svg';
                    }
                  }}
                />
              </div>

              {/* Mock Body */}
              <div className="text-xs space-y-2 px-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Ditagihkan Kepada:</p>
                    <p className="font-bold text-slate-900">PT Pelanggan Contoh Utama</p>
                    <p className="text-[11px] text-slate-500">Klien Operasional {company.company_name || 'Info Papandayan'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-800">INV/2026/10/0001</p>
                    <p className="text-[11px] text-slate-500">Tanggal: 05/10/2026</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden text-[11px]">
                  <div className="bg-slate-100 p-1.5 font-bold flex justify-between">
                    <span>Deskripsi Barang / Layanan</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="p-1.5 flex justify-between border-t border-slate-100">
                    <span>1. Paket Layanan Wisata & Logistik</span>
                    <span className="font-bold">Rp 12.500.000</span>
                  </div>
                </div>
              </div>

              {/* Footer preview */}
              <div className="w-full border-t border-slate-200 pt-2">
                {invoice.footer_text && (
                  <p className="text-[10px] text-center text-slate-500 italic pb-1">
                    {invoice.footer_text}
                  </p>
                )}
                <img
                  src={invoice.footer_image_url || '/invoice-footer.svg'}
                  alt="Footer Preview"
                  className="w-full max-h-16 object-contain mx-auto"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.hasFailed) {
                      target.dataset.hasFailed = 'true';
                      target.src = '/invoice-footer.svg';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Perubahan header, footer, dan identitas kop langsung diterapkan pada cetak PDF A4, pratinjau, dan tautan publik pelanggan.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Kop Header & Footer'}</span>
            </button>
          </div>
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

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleRestoreDefaultPaymentMethods}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Pulihkan daftar default (Bank Mandiri, BCA, BRI, QRIS, Tunai)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Pilihan Standar (5 Metode)</span>
              </button>
              <button
                type="button"
                onClick={handleAddPaymentMethod}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#136239] text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Rekening / Metode</span>
              </button>
            </div>
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

          {/* Public App URL & Vercel / Admin Free Access Section */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#136239]" />
                  <span>Domain / URL Publik Faktur WhatsApp</span>
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    Bebas Login Admin & Vercel
                  </span>
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Domain ini digunakan untuk menyusun tautan faktur resmi pada <code>{'{link_download}'}</code> dan <code>{'{link_pdf}'}</code> agar pelanggan dapat membuka dan mengunduh faktur secara langsung.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                  setInvoice((prev) => ({ ...prev, public_app_url: currentOrigin }));
                  toast.success(`Domain disetel ke: ${currentOrigin}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-[#136239] text-xs font-bold transition cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Gunakan Domain Saat Ini</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={invoice.public_app_url || ''}
                  onChange={(e) => setInvoice({ ...invoice, public_app_url: e.target.value })}
                  placeholder={`Contoh: https://invoice.infopapandayan.com atau ${typeof window !== 'undefined' ? window.location.origin : 'https://nama-aplikasi.vercel.app'}`}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-emerald-300/80 bg-white text-xs font-mono text-slate-900 focus:ring-2 focus:ring-[#136239] shadow-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Kosongkan untuk otomatis menggunakan domain browser saat ini (<code>{typeof window !== 'undefined' ? window.location.origin : 'default'}</code>).
              </p>
            </div>

            {/* Live Sample Generated Links */}
            <div className="bg-white/90 rounded-xl p-3.5 border border-emerald-200/70 space-y-2 text-xs">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Tautan Unduh PDF Faktur Pelanggan (Tanpa Perlu Login):
              </span>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 truncate font-mono text-[11px]">
                <span className="text-slate-500 block text-[10px] font-sans font-bold mb-0.5">
                  Link Unduh Dokumen PDF Resmi (Langsung Download):
                </span>
                <span className="text-emerald-700 font-bold">
                  {(invoice.public_app_url || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '')}/download-pdf?id=1
                </span>
              </div>
            </div>

            {/* Vercel Guidance Note */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Tips Bebas Login Vercel App untuk Pelanggan:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pl-1 leading-relaxed">
                <li>
                  <strong>Matikan Vercel Authentication (Deployment Protection):</strong> Di dashboard Vercel Anda, buka <code>Settings</code> &gt; <code>Deployment Protection</code> &gt; ubah <em>Vercel Authentication</em> menjadi <strong>Disabled</strong>. Ini mencegah Vercel memblokir pelanggan dengan halaman login Vercel.
                </li>
                <li>
                  <strong>Gunakan Custom Domain:</strong> Domain kustom produksi di Vercel (misal: <code>invoice.perusahaan.com</code>) tidak memerlukan login Vercel. Masukkan domain tersebut pada kolom di atas.
                </li>
                <li>
                  <strong>Alternatif Instan:</strong> Anda juga dapat mengklik tombol <em>"Bagikan File PDF Langsung"</em> di menu Pratinjau Invoice untuk mengirim file dokumen PDF secara langsung ke chat WhatsApp pelanggan tanpa tautan web sama sekali!
                </li>
              </ul>
            </div>
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
                { tag: '{link_pdf}', label: 'Link File PDF Langsung' },
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

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Domain / URL Publik Faktur WhatsApp Pelanggan
              </label>
              <button
                type="button"
                onClick={() => {
                  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                  setInvoice((prev) => ({ ...prev, public_app_url: currentOrigin }));
                  toast.success(`Domain disetel ke: ${currentOrigin}`);
                }}
                className="text-xs font-bold text-[#136239] hover:underline cursor-pointer"
              >
                Gunakan Domain Saat Ini
              </button>
            </div>
            <input
              type="url"
              value={invoice.public_app_url || ''}
              onChange={(e) => setInvoice({ ...invoice, public_app_url: e.target.value })}
              placeholder={`Contoh: https://invoice.infopapandayan.com atau ${typeof window !== 'undefined' ? window.location.origin : 'https://nama-aplikasi.vercel.app'}`}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#136239]"
            />
            <p className="text-[11px] text-slate-400">
              Digunakan saat membagikan tautan faktur ke WhatsApp pelanggan agar bisa diakses langsung tanpa login admin & tanpa login Vercel.
            </p>
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

      {/* TAB 7: Cloud Persistence / Multi-Device Sync */}
      {activeTab === 'cloud' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-start justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-600" />
                <span>Sinkronisasi Multi-Device & Cloud Firestore</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Data seluruh produk, pelanggan, invoice, dan pengaturan tersimpan secara permanen di Google Cloud Firestore.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Aktif & Tersinkronisasi
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Status Koneksi Cloud:</span>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {cloudStatus.message}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Penyimpanan Terpadu:</span>
              <p className="text-sm font-bold text-slate-800">
                Google Cloud Firestore (Firebase)
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2 text-xs text-emerald-900">
            <p className="font-bold flex items-center gap-1.5 text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Jaminan Anti Kehilangan Data Antar Perangkat & Browser:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
              <li>
                <strong>Otomatis Tersimpan:</strong> Setiap penambahan produk, pelanggan, atau pembuatan invoice langsung dicadangkan ke Cloud Firestore.
              </li>
              <li>
                <strong>Buka di Browser / HP Lain:</strong> Saat Anda atau tim Anda membuka link aplikasi di smartphone, laptop lain, atau browser baru, data otomatis ditarik dari Cloud Firestore.
              </li>
              <li>
                <strong>Konsumen Tanpa Login:</strong> Pelanggan yang membuka link faktur via WhatsApp tetap dapat mengakses dan mengunduh faktur PDF resmi mereka dari mana saja.
              </li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Ingin mencadangkan paksa perubahan terbaru ke Cloud sekarang?
            </span>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncingCloud}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 cursor-pointer disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${syncingCloud ? 'animate-spin' : ''}`} />
              <span>{syncingCloud ? 'Menyinkronkan...' : 'Sinkronkan Sekarang ke Cloud'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
