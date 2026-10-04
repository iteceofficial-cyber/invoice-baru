import React, { useState } from 'react';
import {
  Download,
  Printer,
  X,
  Send,
  MessageCircle,
  Share2,
  Trash2,
  Check,
  Copy,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { formatRupiah, terbilang, formatDateIndo } from '../lib/utils.ts';
import {
  generateInvoicePDF,
  InvoicePDFData,
  openWhatsAppInvoice,
  shareInvoicePdfDirectly,
  buildWhatsAppInvoiceMessage,
} from '../lib/pdfGenerator.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InvoicePDFData;
  invoiceId?: number | null;
  onDeleteInvoice?: (id: number) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  data,
  invoiceId,
  onDeleteInvoice,
}) => {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState(data.customer_phone || '');
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    generateInvoicePDF(data, 'download');
    toast.success('Mengunduh file PDF A4 resmi...');
  };

  const handlePrint = () => {
    generateInvoicePDF(data, 'print');
  };

  const handleSendWhatsApp = () => {
    openWhatsAppInvoice(data, targetPhone);
    toast.success('Membuka WhatsApp untuk mengirim faktur...');
    setIsSendModalOpen(false);
  };

  const handleSharePdfDirectly = async () => {
    toast.info('Menyiapkan file PDF untuk dibagikan...');
    const shared = await shareInvoicePdfDirectly(data);
    if (shared) {
      toast.success('Faktur PDF berhasil dibagikan');
      setIsSendModalOpen(false);
    } else {
      toast.info('Bagikan file via WhatsApp atau unduh PDF');
    }
  };

  const handleCopySummary = () => {
    const text = buildWhatsAppInvoiceMessage(data);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Ringkasan faktur berhasil disalin ke clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmDelete = () => {
    if (invoiceId && onDeleteInvoice) {
      onDeleteInvoice(invoiceId);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const statusLabel =
    data.status === 'paid'
      ? 'LUNAS / PAID'
      : data.status === 'pending'
      ? 'MENUNGGU PEMBAYARAN'
      : data.status === 'cancelled'
      ? 'DIBATALKAN'
      : 'DRAFT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Action Top Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Pratinjau Cetak A4 Info Papandayan
            </span>
            <span className="text-slate-500">•</span>
            <span className="font-mono text-xs font-bold text-white">
              {data.invoice_number}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Kirim ke Konsumen Option (Requirement #1) */}
            <button
              onClick={() => setIsSendModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-950/20 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim ke Konsumen</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-xs font-bold text-white shadow-md shadow-emerald-950/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            {/* Super Admin Delete Option (Requirement #2) */}
            {isSuperAdmin && invoiceId && onDeleteInvoice && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Hapus Invoice (Super Admin)"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document Paper Container */}
        <div className="overflow-y-auto p-3 sm:p-6 bg-slate-200/80 flex justify-center custom-scrollbar flex-1">
          {/* Actual White Sheet (simulates standard 210mm x 297mm paper) */}
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-[760px] text-slate-900 flex flex-col justify-between overflow-hidden">
            <div>
              {/* 1. OFFICIAL HEADER BANNER (Info Papandayan Image / Custom Super Admin Banner) */}
              <div className="w-full bg-white select-none border-b border-slate-100">
                <img
                  src={data.settings?.header_image_url || '/invoice-header.svg'}
                  alt="Invoice Header"
                  className="w-full h-auto object-contain block"
                />
              </div>

              {/* 2. INVOICE CONTENT BODY */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Recipient & Metadata Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left: Customer Information */}
                  <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/70 space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                      Ditagihkan Kepada (Klien / Wisatawan):
                    </span>
                    <p className="text-base font-extrabold text-slate-900 leading-snug">
                      {data.customer_name || 'Pelanggan / Klien'}
                    </p>
                    {data.customer_address && (
                      <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                        {data.customer_address}
                      </p>
                    )}
                  </div>

                  {/* Right: Invoice Metadata */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5 sm:text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                      Detail Transaksi & Tanggal:
                    </span>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        Nomor Faktur:{' '}
                        <strong className="text-[#136239] font-mono font-bold">
                          {data.invoice_number}
                        </strong>
                      </p>
                      <p>
                        Tanggal Kegiatan:{' '}
                        <strong className="text-slate-900 font-semibold">
                          {formatDateIndo(data.activity_date)}
                        </strong>
                      </p>
                      <div className="pt-1">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            data.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : data.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table Barang / Layanan Wisata */}
                <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-xs">
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
                      {data.items.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.product_name}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatRupiah(item.price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#136239]">
                            {formatRupiah(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Terbilang & Totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                  {/* Left Column: Terbilang & Bank info */}
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Terbilang:
                      </span>
                      <p className="text-xs font-semibold text-[#136239] italic">
                        "{terbilang(data.total_amount)} Rupiah"
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-0.5 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Pembayaran Ditransfer Ke:
                      </span>
                      <p className="font-semibold text-slate-800">
                        Bank: {data.bank_name || 'Bank Mandiri KCP Garut'}
                      </p>
                      <p className="font-mono font-bold text-slate-900">
                        No. Rek : {data.bank_account_no || '131-00-1849201-8'}
                      </p>
                      <p className="text-slate-600">
                        Atas Nama: {data.bank_account_name || 'Info Papandayan / Mohamad Rizal'}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Breakdown & Grand Total */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold">{formatRupiah(data.subtotal)}</span>
                    </div>

                    {data.discount_amount > 0 && (
                      <div className="flex justify-between py-1 text-rose-600">
                        <span>Potongan Diskon</span>
                        <span className="font-semibold">- {formatRupiah(data.discount_amount)}</span>
                      </div>
                    )}

                    <div className="border-t-2 border-[#136239] pt-2 flex justify-between items-center text-white bg-[#136239] p-3 rounded-xl shadow-xs">
                      <span className="text-xs font-bold uppercase tracking-wider">Total Tagihan</span>
                      <span className="text-base font-extrabold tracking-tight">
                        {formatRupiah(data.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes if any */}
                {data.notes && (
                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#136239] block">
                      Catatan & Ketentuan:
                    </span>
                    <p className="whitespace-pre-line leading-relaxed">{data.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. OFFICIAL FOOTER BANNER (Info Papandayan Image with Mohamad Rizal Signature / Custom Super Admin Banner) */}
            <div className="w-full bg-white select-none border-t border-slate-100 mt-2">
              <img
                src={data.settings?.footer_image_url || '/invoice-footer.svg'}
                alt="Invoice Footer"
                className="w-full h-auto object-contain block"
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Kirim Invoice ke Konsumen (Requirement #1) */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#136239] flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Kirim Invoice ke Konsumen</h3>
                  <p className="text-xs text-slate-500">Pilih metode pengiriman dokumen faktur</p>
                </div>
              </div>
              <button
                onClick={() => setIsSendModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Penerima (Konsumen / Klien)
                </label>
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {data.customer_name}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor WhatsApp / Handphone Konsumen
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#136239]"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Pastikan nomor terhubung dengan aplikasi WhatsApp aktif
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleSendWhatsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Kirim via WhatsApp (Teks & Rincian Lengkap)</span>
              </button>

              <button
                onClick={handleSharePdfDirectly}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#136239] hover:bg-[#0f4d2d] text-white font-bold text-xs shadow-md shadow-emerald-950/20 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan Berkas File PDF (Web Share)</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleCopySummary}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Teks Faktur'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#136239]" />
                  <span>Download File PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION: Super Admin Hapus Invoice (Requirement #2) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Invoice (Super Admin)</h3>
                <p className="text-xs text-slate-500">Otoritas penghapusan transaksi</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus faktur invoice{' '}
              <strong className="text-slate-900 font-mono">{data.invoice_number}</strong> untuk klien{' '}
              <strong className="text-slate-900">{data.customer_name}</strong> senilai{' '}
              <strong className="text-[#136239]">{formatRupiah(data.total_amount)}</strong>?
              <span className="block mt-1 text-xs text-slate-500">
                Stok barang yang dikeluarkan oleh faktur ini akan otomatis dikembalikan ke inventaris.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Ya, Hapus Invoice Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
