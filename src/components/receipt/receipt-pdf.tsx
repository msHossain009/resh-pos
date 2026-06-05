import { formatCurrency, formatDateFull } from "@/lib/utils";
import type { Sale, SaleItem } from "@/lib/types";

interface ReceiptPDFProps {
  sale: Sale;
  items: SaleItem[];
  businessName: string;
  tagline: string;
  footer: string;
  cashierName?: string;
}

// Client-side only - generates a print-friendly window for PDF
export function printReceipt(props: ReceiptPDFProps) {
  const { sale, items, businessName, tagline, footer, cashierName } = props;

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:2px 0">${item.product_variants?.products?.name || "Item"} (${item.product_variants?.size_ml}ml)</td>
        <td style="text-align:right;padding:2px 0">${item.quantity}</td>
        <td style="text-align:right;padding:2px 0">${formatCurrency(item.unit_price)}</td>
        <td style="text-align:right;padding:2px 0">${formatCurrency(item.subtotal)}</td>
      </tr>`
    )
    .join("");

  const html = `
    <html>
    <head>
      <style>
        body { font-family: monospace; font-size: 12px; color: #000; margin: 0; padding: 20px; }
        .receipt { max-width: 80mm; margin: 0 auto; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .header h2 { margin: 0; font-size: 16px; letter-spacing: 1px; }
        .header p { margin: 2px 0; font-size: 10px; }
        .info { font-size: 10px; margin-bottom: 8px; }
        .info .row { display: flex; justify-content: space-between; }
        table { width: 100%; font-size: 10px; border-collapse: collapse; margin-bottom: 8px; }
        th { text-align: left; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0; }
        th.right, td.right { text-align: right; }
        .total-row { border-top: 1px dashed #000; font-weight: bold; }
        .footer { text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
        .due { color: #dc2626; }
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h2>${businessName}</h2>
          <p>${tagline}</p>
        </div>
        <div class="info">
          <div class="row"><span>Invoice: ${sale.invoice_no}</span><span>${formatDateFull(sale.created_at)}</span></div>
          <div class="row">
            <span>Customer: ${sale.customers?.name || "Walk-in"}</span>
            ${cashierName ? `<span>Cashier: ${cashierName}</span>` : ""}
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr><td colspan="3" class="right">Subtotal</td><td class="right">${formatCurrency(sale.subtotal)}</td></tr>
            ${sale.discount > 0 ? `<tr><td colspan="3" class="right" style="color:#dc2626">Discount</td><td class="right" style="color:#dc2626">-${formatCurrency(sale.discount)}</td></tr>` : ""}
            ${sale.tax > 0 ? `<tr><td colspan="3" class="right">Tax (${sale.tax_rate}%)</td><td class="right">${formatCurrency(sale.tax)}</td></tr>` : ""}
            <tr class="total-row"><td colspan="3" class="right">Total</td><td class="right">${formatCurrency(sale.total)}</td></tr>
            <tr><td colspan="3" class="right">Paid</td><td class="right">${formatCurrency(sale.paid_amount || sale.total)}</td></tr>
            ${sale.due_amount > 0 ? `<tr class="due"><td colspan="3" class="right">Due</td><td class="right">${formatCurrency(sale.due_amount)}</td></tr>` : ""}
          </tfoot>
        </table>
        <div class="footer">
          <p>Payment: ${sale.payment_method} | ${sale.payment_status}</p>
          <p>${footer}</p>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); window.close(); }
      </script>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
