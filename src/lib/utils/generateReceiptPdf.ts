import jsPDF from 'jspdf';

interface ReceiptPdfOptions {
  orderId: string;
  receiptDate: string;
  customerName?: string;
  items: Array<{
    title: string;
    quantity: number;
    price: number;
    variant?: { size?: string; color?: string };
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
}

export function generateAndDownloadReceiptPdf(options: ReceiptPdfOptions) {
  const {
    orderId,
    receiptDate,
    customerName = 'Valued Client',
    items,
    subtotal,
    tax,
    discount,
    total,
    paymentMethod,
  } = options;

  // 80mm thermal receipt dimensions: 80mm width, dynamic height
  const baseHeight = 160 + (items.length * 12) + (discount > 0 ? 10 : 0);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, Math.max(170, baseHeight)],
  });

  const pageWidth = 80;
  let y = 12;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, Math.max(170, baseHeight), 'F');

  // Header Brand
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 15, 15);
  doc.text('GERKINK', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFontSize(7.5);
  doc.setFont('courier', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('LUXURY & STREETWEAR VAULT', pageWidth / 2, y, { align: 'center' });

  y += 3.5;
  doc.text('https://gerkink.shop', pageWidth / 2, y, { align: 'center' });

  y += 5;
  // Dashed divider
  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(120, 120, 120);
  doc.line(6, y, pageWidth - 6, y);

  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);

  // Metadata
  const shortId = orderId ? `#${orderId.slice(0, 14).toUpperCase()}` : '#GKINK-ORDER';
  doc.setFont('courier', 'bold');
  doc.text('ORDER NO:', 6, y);
  doc.setFont('courier', 'normal');
  doc.text(shortId, pageWidth - 6, y, { align: 'right' });

  y += 4.5;
  doc.setFont('courier', 'bold');
  doc.text('DATE:', 6, y);
  doc.setFont('courier', 'normal');
  doc.text(receiptDate || new Date().toLocaleDateString(), pageWidth - 6, y, { align: 'right' });

  y += 4.5;
  doc.setFont('courier', 'bold');
  doc.text('CLIENT:', 6, y);
  doc.setFont('courier', 'normal');
  doc.text(customerName.slice(0, 22), pageWidth - 6, y, { align: 'right' });

  y += 5;
  doc.line(6, y, pageWidth - 6, y);

  // Items
  y += 6;
  doc.setFont('courier', 'bold');
  doc.text('ITEM', 6, y);
  doc.text('AMOUNT', pageWidth - 6, y, { align: 'right' });

  y += 4.5;
  doc.setFont('courier', 'normal');

  if (items.length > 0) {
    items.forEach((item) => {
      const title = item.title.length > 18 ? `${item.title.substring(0, 18)}...` : item.title;
      const size = item.variant?.size ? ` (${item.variant.size})` : '';
      const lineText = `${title}${size} x${item.quantity}`;
      const linePrice = `$${((item.price || 0) * item.quantity).toFixed(2)}`;

      doc.text(lineText, 6, y);
      doc.text(linePrice, pageWidth - 6, y, { align: 'right' });
      y += 4.5;
    });
  } else {
    doc.text('Garment Vault Order x1', 6, y);
    doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 6, y, { align: 'right' });
    y += 4.5;
  }

  y += 2;
  doc.line(6, y, pageWidth - 6, y);

  // Subtotals
  y += 5;
  doc.text('SUBTOTAL:', 6, y);
  doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 6, y, { align: 'right' });

  y += 4.5;
  doc.text('TAX (8%):', 6, y);
  doc.text(`$${tax.toFixed(2)}`, pageWidth - 6, y, { align: 'right' });

  y += 4.5;
  doc.text('SHIPPING:', 6, y);
  doc.text('FREE', pageWidth - 6, y, { align: 'right' });

  if (discount > 0) {
    y += 4.5;
    doc.setTextColor(200, 30, 30);
    doc.text('PROMO REWARD:', 6, y);
    doc.text(`-$${discount.toFixed(2)}`, pageWidth - 6, y, { align: 'right' });
    doc.setTextColor(20, 20, 20);
  }

  y += 3;
  doc.line(6, y, pageWidth - 6, y);

  // Grand Total
  y += 6;
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL PAID:', 6, y);
  doc.text(`$${total.toFixed(2)}`, pageWidth - 6, y, { align: 'right' });

  y += 5;
  doc.setFontSize(7.5);
  doc.setFont('courier', 'normal');
  doc.setTextColor(39, 174, 96);
  doc.text(`METHOD: ${paymentMethod.toUpperCase()}`, 6, y);

  y += 4;
  doc.setTextColor(120, 120, 120);
  doc.line(6, y, pageWidth - 6, y);

  // Pseudo Barcode lines
  y += 6;
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(20, 20, 20);

  const barcodeStartX = 14;
  const barcodeWidth = pageWidth - 28;
  const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 1, 3, 2, 1, 2, 3, 1, 2, 4, 1, 2];
  let curX = barcodeStartX;

  doc.setLineWidth(0.4);
  for (let i = 0; i < pattern.length && curX < barcodeStartX + barcodeWidth; i++) {
    const w = pattern[i] * 0.45;
    if (i % 2 === 0) {
      doc.rect(curX, y, w, 8, 'F');
    }
    curX += w + 0.3;
  }

  y += 11;
  doc.setFontSize(7);
  doc.setFont('courier', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`* ORD-${orderId ? orderId.slice(0, 8).toUpperCase() : 'GKINK'} *`, pageWidth / 2, y, { align: 'center' });

  // Footer
  y += 6;
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  doc.text('*** OFFICIAL ORDER CONFIRMATION ***', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.text('WEAR YOUR WORTH. NO BORING FASHION.', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.text('Thank you for ordering with GERKINK!', pageWidth / 2, y, { align: 'center' });

  // Save the PDF directly to user downloads
  const filename = `GERKINK-Receipt-${orderId ? orderId.slice(0, 10).toUpperCase() : 'ORDER'}.pdf`;
  doc.save(filename);
}
