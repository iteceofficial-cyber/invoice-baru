import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  Check,
  Copy,
  MessageCircle,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { apiRequest } from '../services/api.ts';
import { formatRupiah, formatDateIndo, terbilang } from '../lib/utils.ts';
import { generateInvoicePDF, InvoicePDFData, PaymentMethodItem } from '../lib/pdfGenerator.ts';

interface PublicInvoiceViewProps {
  invoiceIdentifier: string;
  onGoToLogin?: () => void;
}

export const PublicInvoiceView: React.FC<PublicInvoiceViewProps> = ({
  invoiceIdentifier,
  onGoToLogin,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoicePDFData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [invoiceIdentifier]);

  const loadInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/invoices/public/${encodeURIComponent(invoiceIdentifier)}`);
      if (res.success && res.data) {
        setInvoiceData(res.data);
      } else {
        setError(res.message || 'Faktur invoice tidak ditemukan atau telah dihapus');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat invoice. Silakan coba beberapa saat lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!invoiceData) return;
    generateInvoicePDF(invoiceData, 'download');
  };

  const handlePrint = () => {
    if (!invoiceData) return;
    generateInvoicePDF(invoiceData, 'print');
  };

  const handleCopyAccountNo = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleWhatsAppConfirm = () => {
    if (!invoiceData) return;
    const phone = (invoiceData.company?.phone || '6282240630123').replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    const msg = encodeURIComponent(
      `Halo Admin ${invoiceData.company?.company_name || 'Info Papandayan'},\n\nSaya ingin konfirmasi pembayaran untuk *Invoice No ${invoiceData.invoice_number}* atas nama *${invoiceData.customer_name}* senilai *${formatRupiah(invoiceData.total_amount)}*.\n\nTerima kasih.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#136239] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700">Memuat Faktur Resmi Pelanggan...</p>
        <p className="text-xs text-slate-400 mt-1">Info Papandayan - Invoice & Logistik</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-lg border border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Invoice Tidak Ditemukan</h2>
            <p className="text-xs text-slate-500 mt-1">
              {error || 'Nomor faktur invoice tidak terdaftar atau tautan telah kedaluwarsa.'}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              onClick={() => (window.location.href = '/')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#136239] text-white text-xs font-bold hover:bg-[#0f4d2d] transition"
            >
              Kembali ke Beranda
            </button>
            {onGoToLogin && (
              <button
                onClick={onGoToLogin}
                className="w-full py-2 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Masuk ke Login Admin
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const activeMethods: PaymentMethodItem[] = (() => {
    if (Array.isArray(invoiceData.payment_methods) && invoiceData.payment_methods.length > 0) {
      return invoiceData.payment_methods.filter((m) => m.is_active);
    }
    if (invoiceData.settings?.payment_methods) {
      try {
        const parsed =
          typeof invoiceData.settings.payment_methods === 'string'
            ? JSON.parse(invoiceData.settings.payment_methods)
            : invoiceData.settings.payment_methods;
        return (parsed || []).filter((m: any) => m.is_active);
      } catch {
        return [];
      }
    }
    return [];
  })();

  const isPaid = invoiceData.status === 'paid';

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Floating Action Top Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#136239] flex items-center justify-center font-bold text-sm">
              IP
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                Faktur Invoice Resmi Pelanggan
              </span>
              <h2 className="text-sm font-bold text-slate-900 font-mono">
                {invoiceData.invoice_number}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF Resmi</span>
            </button>
          </div>
        </div>

        {/* Paper Container */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          {/* Header Banner */}
          <div className="w-full bg-white select-none border-b border-slate-100">
            <img
              src={invoiceData.settings?.header_image_url || '/invoice-header.svg'}
              alt="Header Info Papandayan"
              className="w-full h-auto object-contain block max-h-48"
            />
          </div>

          {/* Body */}
          <div className="p-5 sm:p-8 space-y-6">
            {/* Recipient & Metadata (NO CLIENT ADDRESS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: Client info (no address) */}
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                  Ditagihkan Kepada (Klien):
                </span>
                <p className="text-base font-extrabold text-slate-900 leading-snug">
                  {invoiceData.customer_name}
                </p>
                {invoiceData.customer_phone && (
                  <p className="text-xs text-slate-600 pt-0.5">
                    No. Kontak: {invoiceData.customer_phone}
                  </p>
                )}
              </div>

              {/* Right: Transaction info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1 sm:text-right">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                  Detail Transaksi & Tanggal:
                </span>
                <p className="text-xs text-slate-600">
                  Nomor Faktur:{' '}
                  <strong className="text-[#136239] font-mono font-bold">
                    {invoiceData.invoice_number}
                  </strong>
                </p>
                <p className="text-xs text-slate-600">
                  Tanggal Kegiatan:{' '}
                  <strong className="text-slate-900 font-semibold">
                    {formatDateIndo(invoiceData.activity_date)}
                  </strong>
                </p>
                <div className="pt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {isPaid ? 'LUNAS / PAID' : 'MENUNGGU PEMBAYARAN'}
                  </span>
                </div>
              </div>
            </div>

            {/* Table Barang & Layanan */}
            <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#136239] text-white uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Deskripsi Barang / Layanan</th>
                      <th className="py-2.5 px-3 text-center w-24">Qty</th>
                      <th className="py-2.5 px-3 text-right w-32">Harga Satuan</th>
                      <th className="py-2.5 px-3 text-right w-36">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100/60 bg-white">
                    {invoiceData.items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.product_name}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                          {item.qty} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                          {formatRupiah(item.price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatRupiah(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Terbilang & Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Terbilang:
                  </span>
                  <p className="text-xs font-semibold text-[#136239] italic">
                    "{terbilang(invoiceData.total_amount)} Rupiah"
                  </p>
                </div>

                {/* Multiple Payment Methods */}
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#136239] block flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Metode Pembayaran Resmi:</span>
                  </span>

                  {activeMethods.length > 0 ? (
                    <div className="space-y-2">
                      {activeMethods.map((m) => (
                        <div
                          key={m.id}
                          className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-slate-900 block">{m.name}</span>
                            <span className="font-mono font-bold text-emerald-800 text-xs">
                              {m.account_no}
                            </span>
                            <span className="text-slate-500 text-[11px] block">
                              a.n. {m.account_name} {m.notes ? `• ${m.notes}` : ''}
                            </span>
                          </div>
                          {m.account_no && m.category !== 'cash' && (
                            <button
                              type="button"
                              onClick={() => handleCopyAccountNo(m.id, m.account_no)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition shrink-0 cursor-pointer"
                            >
                              {copiedId === m.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500" />
                              )}
                              <span>{copiedId === m.id ? 'Tersalin' : 'Salin Rek'}</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-800">
                        Bank: {invoiceData.bank_name || 'Bank Mandiri KCP Garut'}
                      </p>
                      <p className="font-mono font-bold text-slate-900">
                        No. Rek : {invoiceData.bank_account_no || '131-00-1849201-8'}
                      </p>
                      <p className="text-slate-600">
                        Atas Nama: {invoiceData.bank_account_name || 'Info Papandayan'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Breakdown & Grand Total */}
              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1.5">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Subtotal Barang / Layanan</span>
                    <span className="font-semibold font-mono">{formatRupiah(invoiceData.subtotal)}</span>
                  </div>

                  {invoiceData.discount_amount > 0 && (
                    <div className="flex justify-between py-1 text-rose-600">
                      <span>Potongan Diskon</span>
                      <span className="font-semibold font-mono">- {formatRupiah(invoiceData.discount_amount)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t-2 border-[#136239] p-4 rounded-xl text-white bg-[#136239] flex justify-between items-center shadow-sm">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">
                      Total Tagihan Resmi
                    </span>
                    <span className="text-xs text-emerald-200">
                      {isPaid ? 'Status: Telah Lunas' : 'Menunggu Pembayaran'}
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight font-mono">
                    {formatRupiah(invoiceData.total_amount)}
                  </span>
                </div>

                {/* WhatsApp Confirmation Button */}
                <button
                  type="button"
                  onClick={handleWhatsAppConfirm}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Konfirmasi Pembayaran via WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Notes if any */}
            {invoiceData.notes && (
              <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                  Catatan & Ketentuan Pembayaran:
                </span>
                <p className="whitespace-pre-line leading-relaxed">{invoiceData.notes}</p>
              </div>
            )}
          </div>

          {/* Footer Banner */}
          <div className="w-full bg-white select-none border-t border-slate-100">
            <img
              src={invoiceData.settings?.footer_image_url || '/invoice-footer.svg'}
              alt="Footer Info Papandayan"
              className="w-full h-auto object-contain block max-h-48"
            />
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} {invoiceData.company?.company_name || 'Info Papandayan'}. Seluruh hak cipta dilindungi undang-undang.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#136239] hover:underline mt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Masuk ke Dashboard Sistem Logistik & Invoice</span>
          </a>
        </div>
      </div>
    </div>
  );
};
