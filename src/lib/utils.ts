import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CartItem, SaleTotals } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateId(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateFull(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function calculateSaleTotals(
  items: CartItem[],
  discountType: "amount" | "percent",
  discountValue: number,
  taxRate: number
): SaleTotals {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const discountAmount = discountType === "percent"
    ? subtotal * (Math.min(discountValue, 100) / 100)
    : Math.min(discountValue, subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (Math.max(0, taxRate) / 100);
  const total = taxableAmount + taxAmount;
  const loyaltyEarn = Math.floor(total / 100);
  return { subtotal, discountAmount, taxableAmount, taxAmount, total, loyaltyEarn };
}

export function validateStockBeforeSale(
  items: CartItem[],
  saleType: "retail" | "wholesale" = "retail"
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const item of items) {
    if (item.qty <= 0) {
      errors.push(`${item.productName}: quantity must be greater than 0`);
      continue;
    }

    if (saleType === "retail") {
      // Retail: check perfume ml stock and bottle stock
      const neededMl = item.qty * item.variant.size_ml;
      if (neededMl > (item.variant.stock_ml || 0)) {
        errors.push(
          `${item.productName} (${item.variant.size_ml}ml): only ${item.variant.stock_ml || 0}ml perfume stock, need ${neededMl}ml for ${item.qty} bottle(s)`
        );
      }
      if (item.qty > (item.variant.bottle_stock_qty || 0)) {
        errors.push(
          `${item.productName} (${item.variant.size_ml}ml): only ${item.variant.bottle_stock_qty || 0} bottle(s) in stock`
        );
      }
    } else {
      // Wholesale: check perfume ml stock based on custom ml quantity
      const wholesaleMl = item.wholesaleMl || 0;
      if (wholesaleMl <= 0) {
        errors.push(`${item.productName}: wholesale ml quantity must be specified`);
        continue;
      }
      if (wholesaleMl > (item.variant.stock_ml || 0)) {
        errors.push(
          `${item.productName}: only ${item.variant.stock_ml || 0}ml perfume stock, requested ${wholesaleMl}ml`
        );
      }
      // Check bottle stock if bottle is used
      const bottleQty = item.bottleQty || 0;
      if (bottleQty > (item.variant.bottle_stock_qty || 0)) {
        errors.push(
          `${item.productName}: only ${item.variant.bottle_stock_qty || 0} bottle(s) in stock, need ${bottleQty}`
        );
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
