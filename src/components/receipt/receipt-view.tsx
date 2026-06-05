import { formatCurrency, formatDateFull } from "@/lib/utils";
import type { Sale, SaleItem } from "@/lib/types";

interface ReceiptViewProps {
  sale: Sale;
  items: SaleItem[];
  businessName: string;
  tagline: string;
  footer: string;
  cashierName?: string;
}

export function ReceiptView({ sale, items, businessName, tagline, footer, cashierName }: ReceiptViewProps) {
  return (
    <div id="receipt-print" className="bg-white text-black p-6 max-w-sm mx-auto font-mono text-sm print:block hidden">
      <div className="text-center border-b border-dashed border-black pb-3 mb-3">
        <h2 className="text-lg font-bold tracking-wider">{businessName}</h2>
        <p className="text-xs">{tagline}</p>
      </div>

      <div className="text-xs mb-3 space-y-0.5">
        <div className="flex justify-between">
          <span>Invoice: {sale.invoice_no}</span>
          <span>{formatDateFull(sale.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer: {sale.customers?.name || "Walk-in"}</span>
          <span>{cashierName ? `Cashier: ${cashierName}` : ""}</span>
        </div>
      </div>

      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-t border-b border-dashed border-black">
            <th className="text-left py-1">Item</th>
            <th className="text-right py-1">Qty</th>
            <th className="text-right py-1">Price</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-0.5">{item.product_variants?.products?.name || "Item"} ({item.product_variants?.size_ml}ml)</td>
              <td className="text-right py-0.5">{item.quantity}</td>
              <td className="text-right py-0.5">{formatCurrency(item.unit_price)}</td>
              <td className="text-right py-0.5">{formatCurrency(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-dashed border-black">
            <td colSpan={3} className="text-right py-1 font-semibold">Subtotal</td>
            <td className="text-right py-1">{formatCurrency(sale.subtotal)}</td>
          </tr>
          {sale.discount > 0 && (
            <tr>
              <td colSpan={3} className="text-right py-0.5 text-red-600">Discount</td>
              <td className="text-right py-0.5 text-red-600">-{formatCurrency(sale.discount)}</td>
            </tr>
          )}
          {sale.tax > 0 && (
            <tr>
              <td colSpan={3} className="text-right py-0.5">Tax ({sale.tax_rate}%)</td>
              <td className="text-right py-0.5">{formatCurrency(sale.tax)}</td>
            </tr>
          )}
          <tr className="border-t border-double border-black font-bold">
            <td colSpan={3} className="text-right py-1">Total</td>
            <td className="text-right py-1">{formatCurrency(sale.total)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="text-right py-0.5">Paid</td>
            <td className="text-right py-0.5">{formatCurrency(sale.paid_amount || sale.total)}</td>
          </tr>
          {(sale.due_amount || 0) > 0 && (
            <tr className="text-red-600">
              <td colSpan={3} className="text-right py-0.5">Due</td>
              <td className="text-right py-0.5">{formatCurrency(sale.due_amount || 0)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <div className="text-center text-xs border-t border-dashed border-black pt-2">
        <p>Payment: {sale.payment_method} | {sale.payment_status}</p>
        <p className="mt-1">{footer}</p>
      </div>
    </div>
  );
}

export function getPrintStyles() {
  return `
    @media print {
      body * { visibility: hidden; }
      #receipt-print, #receipt-print * { visibility: visible; }
      #receipt-print { position: fixed; left: 0; top: 0; width: 80mm; }
    }
  `;
}
