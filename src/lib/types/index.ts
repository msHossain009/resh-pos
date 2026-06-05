// Shared TypeScript types for Resh POS

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  barcode: string | null;
  category_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  product_variants?: Variant[];
}

export interface Variant {
  id: string;
  product_id: string;
  size_ml: number;
  concentration: string;
  price: number;
  cost: number;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  barcode: string | null;
  active: boolean;
  created_at: string;
  products?: { name: string; category: string | null };
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  barcode_id: string | null;
  loyalty_points: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  invoice_no: string;
  customer_id: string | null;
  sale_date: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  order_type: "Online" | "Offline";
  notes: string | null;
  paid_amount: number;
  due_amount: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: "amount" | "percent";
  created_by: string | null;
  created_at: string;
  customers?: { name: string } | null;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  product_variants?: Variant;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  status: "Pending" | "Partially Received" | "Received" | "Cancelled";
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
  purchase_order_items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  variant_id: string;
  quantity: number;
  unit_cost: number;
  received_quantity: number;
  created_at: string;
  product_variants?: Variant;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  date: string;
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockMovement {
  id: string;
  variant_id: string;
  type: "sale" | "purchase_receive" | "adjustment" | "return" | "damage";
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  tagline: string;
  currency: string;
  tax_rate: number;
  receipt_footer: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: "admin" | "manager" | "cashier" | "viewer";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  variant: Variant;
  productName: string;
  qty: number;
  unitPrice: number;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
  loyaltyEarn: number;
}

export const MEMBERSHIP_TIERS = [
  { name: "Regular", minSpent: 0 },
  { name: "Silver", minSpent: 5000 },
  { name: "Gold", minSpent: 25000 },
  { name: "VIP", minSpent: 100000 },
] as const;

export function getMembershipTier(totalSpent: number): string {
  const tier = [...MEMBERSHIP_TIERS].reverse().find((t) => totalSpent >= t.minSpent);
  return tier?.name ?? "Regular";
}
