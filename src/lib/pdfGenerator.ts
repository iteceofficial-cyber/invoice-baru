import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRupiah, terbilang, formatDateIndo } from './utils.ts';

export interface PaymentMethodItem {
  id: string;
  name: string;
  category: 'bank' | 'qris' | 'cash' | 'other' | string;
  account_no: string;
  account_name: string;
  notes?: string;
  is_active: boolean;
}

export const DEFAULT_WHATSAPP_TEMPLATE = `*INFO PAPANDAYAN - FAKTUR INVOICE RESMI*

Yth. Bapak/Ibu *{nama_pelanggan}*,
Terima kasih atas kepercayaannya menggunakan layanan Info Papandayan. Berikut ringkasan faktur tagihan Anda:

📄 *No. Invoice:* {nomor_invoice}
📅 *Tanggal Kegiatan:* {tanggal}
🏷️ *Total Tagihan:* *{total}*
💳 *Status:* *{status}*

📋 *Rincian Layanan/Barang:*
{rincian_barang}

🏦 *Metode Pembayaran Resmi:*
{metode_pembayaran}

📥 *Link Unduh / Cetak Invoice:*
{link_download}

{catatan}

Faktur invoice resmi dalam format PDF siap diunduh melalui tautan di atas. Silakan hubungi kami apabila memerlukan penyesuaian.

Salam hangat,
*{nama_perusahaan}*
WhatsApp: {telepon_perusahaan}
Website: {website_perusahaan}`;

export const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
  {
    id: 'mandiri-1',
    name: 'Bank Mandiri',
    category: 'bank',
    account_no: '131-00-1849201-8',
    account_name: 'Info Papandayan',
    notes: 'KCP Garut',
    is_active: true,
  },
  {
    id: 'bca-1',
    name: 'Bank BCA',
    category: 'bank',
    account_no: '148-098-7654',
    account_name: 'Info Papandayan',
    notes: 'KCU Garut',
    is_active: true,
  },
  {
    id: 'bri-1',
    name: 'Bank BRI',
    category: 'bank',
    account_no: '0102-01-098765-50-1',
    account_name: 'Info Papandayan',
    notes: 'Cabang Cisurupan',
    is_active: false,
  },
  {
    id: 'qris-1',
    name: 'QRIS Resmi Info Papandayan',
    category: 'qris',
    account_no: 'NMID: ID1020030040500',
    account_name: 'Info Papandayan',
    notes: 'Dapat di-scan melalui BCA Mobile, Livin, GoPay, OVO, Dana, ShopeePay',
    is_active: false,
  },
  {
    id: 'cash-1',
    name: 'Pembayaran Tunai / Cash',
    category: 'cash',
    account_no: 'Kasir Kantor',
    account_name: 'Info Papandayan',
    notes: 'Pembayaran langsung di kantor operasional Cisurupan Garut',
    is_active: false,
  },
];

export interface InvoicePDFData {
  id?: number;
  invoice_number: string;
  customer_name: string;
  customer_address?: string;
  customer_phone?: string;
  activity_date: string;
  due_date?: string;
  bank_account_no?: string;
  bank_name?: string;
  bank_account_name?: string;
  notes?: string;
  subtotal: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  items: Array<{
    product_code: string;
    product_name: string;
    qty: number;
    unit: string;
    price: number;
    subtotal: number;
  }>;
  company?: {
    company_name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  settings?: {
    signature_text?: string;
    signer_name?: string;
    signer_title?: string;
    footer_text?: string;
    primary_color?: string;
    header_image_url?: string;
    footer_image_url?: string;
    whatsapp_template?: string;
    payment_methods?: PaymentMethodItem[] | string;
  };
  payment_methods?: PaymentMethodItem[];
}

export function getSafeInvoiceFilename(data: InvoicePDFData): string {
  const sanitize = (val: string) =>
    (val || '')
      .trim()
      .replace(/[^\w\s-]/gi, '')
      .replace(/\s+/g, '_') || 'doc';

  const safeNumber = sanitize(data?.invoice_number || 'INV');
  const safeCustomer = sanitize(data?.customer_name || 'Pelanggan');
  const safeDate = sanitize(data?.activity_date || '');

  return `Invoice_${safeNumber}_${safeCustomer}_${safeDate}.pdf`;
}

async function loadRasterOrSvgAsPng(url: string, targetWidth = 1200, targetHeight = 310): Promise<string> {
  if (!url) return '';

  // If already a base64 raster data URL, return directly
  if (url.startsWith('data:image/png') || url.startsWith('data:image/jpeg') || url.startsWith('data:image/webp')) {
    return url;
  }

  return new Promise(async (resolve) => {
    let resolved = false;
    const safeResolve = (val: string) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    // Safety timeout: Never hang PDF generation for more than 3 seconds on image loading
    const timeoutTimer = setTimeout(() => {
      safeResolve('');
    }, 3000);

    try {
      let finalSrc = url;

      // If it's an SVG file or SVG data url, fetch and remove any remote @import to avoid tainted canvas
      if (url.includes('.svg') || url.startsWith('data:image/svg')) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            let svgText = await res.text();
            // Strip any @import url(...) to guarantee canvas will not be tainted
            svgText = svgText.replace(/@import\s+url\([^)]+\);?/gi, '');
            finalSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
          }
        } catch {
          // If fetch fails, fall back to direct url
          finalSrc = url;
        }
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        clearTimeout(timeoutTimer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            safeResolve(canvas.toDataURL('image/png'));
          } else {
            safeResolve('');
          }
        } catch {
          safeResolve('');
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutTimer);
        safeResolve('');
      };
      img.src = finalSrc;
    } catch {
      clearTimeout(timeoutTimer);
      safeResolve('');
    }
  });
}

export async function generateInvoicePDF(data: InvoicePDFData, action: 'download' | 'print' = 'download') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Use configured header & footer images from super admin settings, with defaults
  const headerUrl = data.settings?.header_image_url || '/invoice-header.svg';
  const footerUrl = data.settings?.footer_image_url || '/invoice-footer.svg';

  // Load Header and Footer images asynchronously
  const [headerPng, footerPng] = await Promise.all([
    loadRasterOrSvgAsPng(headerUrl, 1200, 310),
    loadRasterOrSvgAsPng(footerUrl, 1200, 310),
  ]);

  // 1. Draw Header Image banner (exact Info Papandayan header)
  const headerHeight = 44; // mm
  if (headerPng) {
    doc.addImage(headerPng, 'PNG', 0, 0, pageWidth, headerHeight);
  } else {
    // Fallback if image failed to load
    doc.setFillColor(19, 98, 57);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(data.company?.company_name || 'Info Papandayan', margin, 18);
  }

  // 2. Invoice Details Section (below header)
  const infoY = headerHeight + 6;

  // Left side: Ditagihkan Kepada (Bill To)
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.roundedRect(margin, infoY, 92, 28, 1.5, 1.5, 'F');
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, infoY, 92, 28, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(19, 98, 57); // forest green
  doc.text('DITAGIHKAN KEPADA (KLIEN):', margin + 3.5, infoY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  const safeCustName1 = String(data?.customer_name || 'Pelanggan / Klien');
  const custNameLines = doc.splitTextToSize(safeCustName1, 85);
  doc.text(custNameLines, margin + 3.5, infoY + 12);

  // Right side: Informasi Transaksi
  const rightX = pageWidth - margin - 88;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX, infoY, 88, 28, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, infoY, 88, 28, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(19, 98, 57);
  doc.text('DETAIL TRANSAKSI:', rightX + 3.5, infoY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Nomor Faktur', rightX + 3.5, infoY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 98, 57);
  doc.text(`: ${data.invoice_number}`, rightX + 26, infoY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Tanggal', rightX + 3.5, infoY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${formatDateIndo(data.activity_date)}`, rightX + 26, infoY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Status', rightX + 3.5, infoY + 20);
  doc.setFont('helvetica', 'bold');
  if (data.status === 'paid') {
    doc.setTextColor(22, 101, 52); // green
    doc.text(': LUNAS (PAID)', rightX + 26, infoY + 20);
  } else if (data.status === 'pending') {
    doc.setTextColor(180, 83, 9); // amber
    doc.text(': MENUNGGU (PENDING)', rightX + 26, infoY + 20);
  } else {
    doc.setTextColor(100, 116, 139);
    doc.text(`: ${data.status.toUpperCase()}`, rightX + 26, infoY + 20);
  }

  // 3. Items Table (with Info Papandayan matching theme)
  const tableStartY = infoY + 31;

  const tableBody = data.items.map((item, index) => [
    index + 1,
    item.product_name,
    `${item.qty} ${item.unit || 'Pcs'}`,
    formatRupiah(item.price),
    formatRupiah(item.subtotal),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['No', 'Deskripsi Barang / Layanan Wisata', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [19, 98, 57], // Forest Green #136239
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 2.8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 35 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 4;

  // 4. Summary & Terbilang Section
  const leftBoxWidth = 98;
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.roundedRect(margin, finalY, leftBoxWidth, 34, 1.5, 1.5, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, finalY, leftBoxWidth, 34, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(19, 98, 57);
  doc.text('TERBILANG:', margin + 3.5, finalY + 5);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.setTextColor(19, 98, 57);
  const terbilangLines = doc.splitTextToSize(`"${terbilang(data.total_amount)}"`, leftBoxWidth - 7);
  doc.text(terbilangLines, margin + 3.5, finalY + 10);

  // Bank Info in Left Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PEMBAYARAN RESMI DITRANSFER KE:', margin + 3.5, finalY + 18);

  let activeMethods: PaymentMethodItem[] = [];
  if (Array.isArray(data.payment_methods) && data.payment_methods.length > 0) {
    activeMethods = data.payment_methods.filter((m) => m.is_active);
  } else if (data.settings?.payment_methods) {
    try {
      const parsed = typeof data.settings.payment_methods === 'string'
        ? JSON.parse(data.settings.payment_methods)
        : data.settings.payment_methods;
      activeMethods = (parsed || []).filter((m: any) => m.is_active);
    } catch {}
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  if (activeMethods.length > 0) {
    let mY = finalY + 22.5;
    for (let i = 0; i < Math.min(activeMethods.length, 3); i++) {
      const m = activeMethods[i];
      doc.setFont('helvetica', 'bold');
      doc.text(`${m.name}:`, margin + 3.5, mY);
      doc.setFont('helvetica', 'normal');
      const valStr = m.category === 'cash' ? (m.notes || 'Kasir Kantor') : `${m.account_no} (a.n. ${m.account_name})`;
      const labelW = doc.getTextWidth(`${m.name}: `);
      const splitVal = doc.splitTextToSize(valStr, 92 - labelW - 6);
      doc.text(splitVal[0] || valStr, margin + 3.5 + labelW, mY);
      mY += 4.5;
    }
  } else {
    doc.text(`Bank       : ${data.bank_name || 'Bank Mandiri KCP Garut'}`, margin + 3.5, finalY + 23);
    doc.text(`No. Rek : ${data.bank_account_no || '131-00-1849201-8'}`, margin + 3.5, finalY + 27.5);
    doc.text(`A.n.        : ${data.bank_account_name || 'Info Papandayan / Mohamad Rizal'}`, margin + 3.5, finalY + 32);
  }

  // Right Side: Subtotal, Diskon, Pajak, Grand Total
  const sumX = pageWidth - margin - 65;
  let currSumY = finalY + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', sumX, currSumY);
  doc.text(formatRupiah(data.subtotal), pageWidth - margin, currSumY, { align: 'right' });

  if (data.discount_amount > 0) {
    currSumY += 5;
    doc.text('Diskon Potongan', sumX, currSumY);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${formatRupiah(data.discount_amount)}`, pageWidth - margin, currSumY, { align: 'right' });
    doc.setTextColor(71, 85, 105);
  }

  currSumY += 7;
  // Total Highlight Box
  doc.setFillColor(19, 98, 57); // Forest Green
  doc.roundedRect(sumX - 2, currSumY - 4, 67, 10, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TAGIHAN', sumX, currSumY + 2.5);
  doc.text(formatRupiah(data.total_amount), pageWidth - margin - 1, currSumY + 2.5, { align: 'right' });

  // 5. Notes if any
  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(19, 98, 57);
    doc.text('CATATAN / KETENTUAN:', margin, finalY + 39);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(splitNotes, margin, finalY + 43);
  }

  // 6. Draw Footer Image Banner (exact Info Papandayan footer with Mohamad Rizal signature)
  const footerHeight = 44; // mm
  const footerY = pageHeight - footerHeight;

  if (footerPng) {
    doc.addImage(footerPng, 'PNG', 0, footerY, pageWidth, footerHeight);
  } else {
    // Fallback if image not loaded
    doc.setFillColor(19, 98, 57);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(data.settings?.signer_name || 'Mohamad Rizal', pageWidth - margin - 20, pageHeight - 12, { align: 'center' });
  }

  const cleanFilename = getSafeInvoiceFilename(data);

  if (action === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = blobUrl.toString();
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.contentWindow?.print();
    }, 500);
  } else {
    doc.save(cleanFilename);
  }
}

// Generate PDF Blob for sharing or attachments
export async function generateInvoicePDFBlob(data: InvoicePDFData): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const headerUrl = data.settings?.header_image_url || '/invoice-header.svg';
  const footerUrl = data.settings?.footer_image_url || '/invoice-footer.svg';

  const [headerPng, footerPng] = await Promise.all([
    loadRasterOrSvgAsPng(headerUrl, 1200, 310),
    loadRasterOrSvgAsPng(footerUrl, 1200, 310),
  ]);

  const headerHeight = 44;
  if (headerPng) {
    doc.addImage(headerPng, 'PNG', 0, 0, pageWidth, headerHeight);
  } else {
    doc.setFillColor(19, 98, 57);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
  }

  const infoY = headerHeight + 6;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, infoY, 92, 28, 1.5, 1.5, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, infoY, 92, 28, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(19, 98, 57);
  doc.text('DITAGIHKAN KEPADA (KLIEN):', margin + 3.5, infoY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  const safeCustName2 = String(data?.customer_name || 'Pelanggan / Klien');
  const custNameLines2 = doc.splitTextToSize(safeCustName2, 85);
  doc.text(custNameLines2, margin + 3.5, infoY + 12);

  const rightX = pageWidth - margin - 88;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX, infoY, 88, 28, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, infoY, 88, 28, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(19, 98, 57);
  doc.text('RINCIAN TAGIHAN:', rightX + 3.5, infoY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Nomor Faktur', rightX + 3.5, infoY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(19, 98, 57);
  doc.text(data.invoice_number, rightX + 38, infoY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Tgl. Kegiatan', rightX + 3.5, infoY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateIndo(data.activity_date), rightX + 38, infoY + 15);

  const statusLabel =
    data.status === 'paid'
      ? 'LUNAS / PAID'
      : data.status === 'pending'
      ? 'MENUNGGU PEMBAYARAN'
      : data.status === 'cancelled'
      ? 'DIBATALKAN'
      : 'DRAFT';

  const badgeColor = data.status === 'paid' ? [19, 98, 57] : [217, 119, 6];
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(rightX + 3.5, infoY + 20, 48, 5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, rightX + 27.5, infoY + 23.5, { align: 'center' });

  const tableBody = data.items.map((it, idx) => [
    idx + 1,
    it.product_name,
    `${it.qty} ${it.unit}`,
    formatRupiah(it.price),
    formatRupiah(it.subtotal),
  ]);

  const tableStartY = infoY + 32;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['No', 'Nama Barang / Layanan Wisata', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [19, 98, 57],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.4,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 35 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 4;

  const terbilangText = terbilang(data.total_amount) + ' Rupiah';
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, finalY, 110, 13, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, finalY, 110, 13, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TERBILANG:', margin + 3.5, finalY + 4);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7.5);
  doc.setTextColor(19, 98, 57);
  const splitTerbilang = doc.splitTextToSize(`"${terbilangText}"`, 103);
  doc.text(splitTerbilang, margin + 3.5, finalY + 8.5);

  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, finalY + 15, 110, 20, 1.5, 1.5, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, finalY + 15, 110, 20, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PEMBAYARAN RESMI DITRANSFER KE:', margin + 3.5, finalY + 18);

  let activeMethodsBlob: PaymentMethodItem[] = [];
  if (Array.isArray(data.payment_methods) && data.payment_methods.length > 0) {
    activeMethodsBlob = data.payment_methods.filter((m) => m.is_active);
  } else if (data.settings?.payment_methods) {
    try {
      const parsed = typeof data.settings.payment_methods === 'string'
        ? JSON.parse(data.settings.payment_methods)
        : data.settings.payment_methods;
      activeMethodsBlob = (parsed || []).filter((m: any) => m.is_active);
    } catch {}
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  if (activeMethodsBlob.length > 0) {
    let mY = finalY + 22.5;
    for (let i = 0; i < Math.min(activeMethodsBlob.length, 3); i++) {
      const m = activeMethodsBlob[i];
      doc.setFont('helvetica', 'bold');
      doc.text(`${m.name}:`, margin + 3.5, mY);
      doc.setFont('helvetica', 'normal');
      const valStr = m.category === 'cash' ? (m.notes || 'Kasir Kantor') : `${m.account_no} (a.n. ${m.account_name})`;
      const labelW = doc.getTextWidth(`${m.name}: `);
      const splitVal = doc.splitTextToSize(valStr, 92 - labelW - 6);
      doc.text(splitVal[0] || valStr, margin + 3.5 + labelW, mY);
      mY += 4.5;
    }
  } else {
    doc.text(`Bank       : ${data.bank_name || 'Bank Mandiri KCP Garut'}`, margin + 3.5, finalY + 23);
    doc.text(`No. Rek : ${data.bank_account_no || '131-00-1849201-8'}`, margin + 3.5, finalY + 27.5);
    doc.text(`A.n.        : ${data.bank_account_name || 'Info Papandayan / Mohamad Rizal'}`, margin + 3.5, finalY + 32);
  }

  const sumX = pageWidth - margin - 65;
  let currSumY = finalY + 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', sumX, currSumY);
  doc.text(formatRupiah(data.subtotal), pageWidth - margin, currSumY, { align: 'right' });

  if (data.discount_amount > 0) {
    currSumY += 5;
    doc.text('Diskon Potongan', sumX, currSumY);
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${formatRupiah(data.discount_amount)}`, pageWidth - margin, currSumY, { align: 'right' });
    doc.setTextColor(71, 85, 105);
  }

  currSumY += 7;
  doc.setFillColor(19, 98, 57);
  doc.roundedRect(sumX - 2, currSumY - 4, 67, 10, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TAGIHAN', sumX, currSumY + 2.5);
  doc.text(formatRupiah(data.total_amount), pageWidth - margin - 1, currSumY + 2.5, { align: 'right' });

  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(19, 98, 57);
    doc.text('CATATAN / KETENTUAN:', margin, finalY + 39);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(splitNotes, margin, finalY + 43);
  }

  const footerHeight = 44;
  const footerY = pageHeight - footerHeight;

  if (footerPng) {
    doc.addImage(footerPng, 'PNG', 0, footerY, pageWidth, footerHeight);
  } else {
    doc.setFillColor(19, 98, 57);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
  }

  const filename = getSafeInvoiceFilename(data);
  const blob = doc.output('blob');

  return { blob, filename };
}

// Generate prefilled Indonesian WhatsApp message for invoice with customizable template & download link
export function buildWhatsAppInvoiceMessage(
  data: InvoicePDFData,
  templateOverride?: string,
  downloadUrlOverride?: string
): string {
  const statusStr =
    data.status === 'paid'
      ? 'LUNAS (PAID)'
      : data.status === 'pending'
      ? 'MENUNGGU PEMBAYARAN'
      : data.status === 'cancelled'
      ? 'DIBATALKAN'
      : data.status.toUpperCase();

  const itemsList = data.items
    .map(
      (it, idx) =>
        `  ${idx + 1}. ${it.product_name} (${it.qty} ${it.unit}) = ${formatRupiah(it.subtotal)}`
    )
    .join('\n');

  // Format payment methods
  let methodsList: PaymentMethodItem[] = [];
  if (Array.isArray(data.payment_methods) && data.payment_methods.length > 0) {
    methodsList = data.payment_methods;
  } else if (data.settings?.payment_methods) {
    try {
      methodsList =
        typeof data.settings.payment_methods === 'string'
          ? JSON.parse(data.settings.payment_methods)
          : data.settings.payment_methods;
    } catch {
      methodsList = [];
    }
  }

  const activeMethods = methodsList.filter((m) => m.is_active);
  let paymentText = '';
  if (activeMethods.length > 0) {
    paymentText = activeMethods
      .map((m) => {
        if (m.category === 'cash') {
          return `• *${m.name}*: ${m.notes || 'Pembayaran langsung di kasir kantor'}`;
        }
        if (m.category === 'qris') {
          return `• *${m.name}* (${m.account_name}): ${m.account_no}${m.notes ? ` - ${m.notes}` : ''}`;
        }
        return `• *${m.name}*: ${m.account_no} (a.n. ${m.account_name})${m.notes ? ` - ${m.notes}` : ''}`;
      })
      .join('\n');
  } else {
    paymentText = `Bank: ${data.bank_name || 'Bank Mandiri KCP Garut'}\nNo. Rekening: ${data.bank_account_no || '131-00-1849201-8'}\nAtas Nama: ${data.bank_account_name || 'Info Papandayan / Mohamad Rizal'}`;
  }

  // Generate public download link (interactive web view & direct PDF link)
  const cleanInvNumber = encodeURIComponent(data.invoice_number);
  const idQuery = data.id ? `&id=${data.id}` : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const downloadLink =
    downloadUrlOverride ||
    (origin ? `${origin}/?inv=${cleanInvNumber}${idQuery}` : `/?inv=${cleanInvNumber}${idQuery}`);
  const directPdfLink = origin
    ? `${origin}/api/invoices/public/download-pdf?inv=${cleanInvNumber}${idQuery}`
    : `/api/invoices/public/download-pdf?inv=${cleanInvNumber}${idQuery}`;

  const defaultTemplate = `*INFO PAPANDAYAN - FAKTUR INVOICE RESMI*

Yth. Bapak/Ibu *{nama_pelanggan}*,
Terima kasih atas kepercayaannya menggunakan layanan Info Papandayan. Berikut ringkasan faktur tagihan Anda:

📄 *No. Invoice:* {nomor_invoice}
📅 *Tanggal Kegiatan:* {tanggal}
🏷️ *Total Tagihan:* *{total}*
💳 *Status:* *{status}*

📋 *Rincian Layanan/Barang:*
{rincian_barang}

🏦 *Metode Pembayaran Resmi:*
{metode_pembayaran}

📥 *Link Unduh / Cetak Invoice:*
{link_download}

{catatan}

Faktur invoice resmi dalam format PDF siap diunduh melalui tautan di atas. Silakan hubungi kami apabila memerlukan penyesuaian.

Salam hangat,
*{nama_perusahaan}*
WhatsApp: {telepon_perusahaan}
Website: {website_perusahaan}`;

  const template = templateOverride || data.settings?.whatsapp_template || defaultTemplate;
  const notesText = data.notes ? `📝 *Catatan:* ${data.notes}` : '';

  const result = template
    .replace(/\{nomor_invoice\}/g, data.invoice_number || '')
    .replace(/\{nama_pelanggan\}/g, data.customer_name || 'Pelanggan')
    .replace(/\{tanggal\}/g, formatDateIndo(data.activity_date))
    .replace(/\{jatuh_tempo\}/g, data.due_date ? formatDateIndo(data.due_date) : '-')
    .replace(/\{total\}/g, formatRupiah(data.total_amount))
    .replace(/\{status\}/g, statusStr)
    .replace(/\{rincian_barang\}/g, itemsList)
    .replace(/\{metode_pembayaran\}/g, paymentText)
    .replace(/\{link_download\}/g, downloadLink)
    .replace(/\{link_unduh\}/g, downloadLink)
    .replace(/\{link_pdf\}/g, directPdfLink)
    .replace(/\{link_direct\}/g, directPdfLink)
    .replace(/\{catatan\}/g, notesText)
    .replace(/\{nama_perusahaan\}/g, data.company?.company_name || 'Info Papandayan')
    .replace(/\{telepon_perusahaan\}/g, data.company?.phone || '+62 822-4063-0123 / +62 813-2127-3552')
    .replace(/\{website_perusahaan\}/g, data.company?.website || 'https://infopapandayan.com');

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

// Direct action to open WhatsApp to send invoice to customer
export function openWhatsAppInvoice(
  data: InvoicePDFData,
  phoneOverride?: string,
  customMessageText?: string
) {
  let phone = phoneOverride || data.customer_phone || '';
  phone = phone.replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1);
  } else if (!phone.startsWith('62') && phone.length > 5) {
    phone = '62' + phone;
  }

  const messageText = customMessageText || buildWhatsAppInvoiceMessage(data);
  const message = encodeURIComponent(messageText);
  const waUrl = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;

  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 300);
}

// Share PDF file directly via Web Share API
export async function shareInvoicePdfDirectly(data: InvoicePDFData): Promise<boolean> {
  try {
    const { blob, filename } = await generateInvoicePDFBlob(data);
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Invoice ${data.invoice_number} - Info Papandayan`,
        text: `Faktur resmi Info Papandayan No ${data.invoice_number} untuk ${data.customer_name}`,
        files: [file],
      });
      return true;
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Share not completed:', err);
    }
  }
  return false;
}

// Generate PDF for Laporan Barang Keluar in matching Forest Green
export function generateItemsOutPDF(reportData: any[], summary: any, filterLabel: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Header band
  doc.setFillColor(19, 98, 57); // Forest Green
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('INFO PAPANDAYAN - LAPORAN PENGELUARAN BARANG & LOGISTIK', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229);
  doc.text(`Filter Periode: ${filterLabel} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`, margin, 18);

  // Summary row
  const summaryY = 28;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, summaryY, pageWidth - margin * 2, 11, 1.5, 1.5, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, summaryY, pageWidth - margin * 2, 11, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(19, 98, 57);
  doc.text(`Total Transaksi: ${summary.total_transaksi || 0}`, margin + 6, summaryY + 7);
  doc.text(`Total Jenis Produk: ${summary.total_jenis_barang || 0}`, margin + 50, summaryY + 7);
  doc.text(`Total Qty Keluar: ${summary.total_qty_keluar || 0}`, margin + 110, summaryY + 7);
  doc.text(`Total Nilai: ${formatRupiah(summary.total_nilai_keluar || 0)}`, margin + 175, summaryY + 7);

  // Table
  const tableBody = reportData.map((row, idx) => [
    idx + 1,
    formatDateIndo(row.tanggal),
    row.nomor_invoice,
    row.nama_pelanggan,
    row.kode_produk,
    row.nama_barang,
    `${row.jumlah} ${row.satuan}`,
    formatRupiah(row.harga),
    formatRupiah(row.total_nilai),
  ]);

  autoTable(doc, {
    startY: summaryY + 15,
    margin: { left: margin, right: margin },
    head: [['No', 'Tanggal', 'No. Invoice', 'Pelanggan', 'Kode', 'Nama Barang / Produk', 'Qty Keluar', 'Harga Satuan', 'Total Nilai']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [19, 98, 57],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2.2,
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { cellWidth: 35 },
      3: { cellWidth: 48 },
      4: { cellWidth: 22 },
      5: { cellWidth: 'auto' },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'right', cellWidth: 26 },
      8: { halign: 'right', cellWidth: 28 },
    },
  });

  doc.save(`Laporan-Barang-Keluar-InfoPapandayan-${new Date().toISOString().split('T')[0]}.pdf`);
}
