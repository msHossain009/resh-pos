export const APP_NAME = "Resh POS";
export const APP_TAGLINE = "SCENT YOUR WAY TO UNFORGETTABLE";

export const ID_PREFIXES = {
  product: "PRD",
  variant: "VAR",
  invoice: "INV",
  customer: "CST",
  supplier: "SUP",
  purchaseOrder: "PO",
} as const;

export const CURRENCY = {
  code: "BDT",
  symbol: "৳",
  locale: "bn-BD",
} as const;

export const TAX_RATE_DEFAULT = 5;
export const LOW_STOCK_THRESHOLD = 10;

export const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Card", "Bank Transfer"] as const;
export const ORDER_TYPES = ["Online", "Offline"] as const;
export const PO_STATUSES = ["Pending", "Partially Received", "Received", "Cancelled"] as const;

export const BRAND = {
  name: "RESH",
  colors: {
    gold: "#c9a96e",
    goldDark: "#d4b87a",
    charcoal: "#1a1a2e",
    cream: "#f8f4ef",
    burgundy: "#6B2737",
  },
} as const;
