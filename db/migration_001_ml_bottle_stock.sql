-- Resh POS Migration 001: ML/Bottle Stock, Customer Type, Sale Type/Status
-- Run this in your Supabase SQL Editor (standalone — creates missing tables automatically)

-- ============================================================
-- BOOTSTRAP: Ensure all referenced tables exist (in dependency order)
-- Safe to re-run; uses IF NOT EXISTS everywhere
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SEQUENCE IF NOT EXISTS product_seq START 1;
CREATE SEQUENCE IF NOT EXISTS variant_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE SEQUENCE IF NOT EXISTS supplier_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  barcode TEXT UNIQUE DEFAULT ('PRD-' || LPAD(NEXTVAL('product_seq')::TEXT, 4, '0')),
  category_id UUID REFERENCES categories(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_ml NUMERIC(8,2) NOT NULL DEFAULT 50,
  concentration TEXT DEFAULT 'EDP',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  sku TEXT UNIQUE DEFAULT ('VAR-' || LPAD(NEXTVAL('variant_seq')::TEXT, 4, '0')),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  barcode TEXT UNIQUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT DEFAULT 'Resh POS',
  tagline TEXT DEFAULT 'SCENT YOUR WAY TO UNFORGETTABLE',
  currency TEXT DEFAULT 'BDT',
  tax_rate NUMERIC DEFAULT 5,
  receipt_footer TEXT DEFAULT 'Thank you for choosing Resh Perfumes!',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO business_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM business_settings);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  barcode_id TEXT UNIQUE DEFAULT ('CST-' || LPAD(NEXTVAL('customer_seq')::TEXT, 4, '0')),
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no TEXT UNIQUE NOT NULL DEFAULT ('INV-' || LPAD(NEXTVAL('invoice_seq')::TEXT, 6, '0')),
  customer_id UUID REFERENCES customers(id),
  sale_date DATE DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  payment_status TEXT DEFAULT 'Paid',
  order_type TEXT DEFAULT 'Offline' CHECK (order_type IN ('Online', 'Offline')),
  notes TEXT,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  due_amount NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('amount', 'percent')) DEFAULT 'amount',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('sale', 'purchase_receive', 'adjustment', 'return', 'damage')),
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 1. product_variants: Add ml/bottle stock and wholesale fields
-- ============================================================
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS stock_ml NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_ml_threshold NUMERIC(12,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS bottle_stock_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_bottle_threshold INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS retail_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS retail_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS wholesale_price_per_ml NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS wholesale_cost_per_ml NUMERIC(12,2);

-- Migrate existing stock_quantity data into stock_ml
UPDATE product_variants
SET stock_ml = stock_quantity,
    retail_price = price,
    retail_cost = cost
WHERE stock_ml IS NULL OR stock_ml = 0;

-- ============================================================
-- 2. stock_movements: Add ml and bottle tracking fields
-- ============================================================
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS perfume_ml_change NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bottle_qty_change INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_perfume_ml NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_perfume_ml NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_bottle_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_bottle_qty INTEGER DEFAULT 0;

-- Update type check constraint to include new types
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('sale', 'purchase_receive', 'adjustment', 'return', 'damage', 'cancel_return'));

-- ============================================================
-- 3. customers: Add customer_type
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale')),
  ADD COLUMN IF NOT EXISTS due_amount NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- 4. sales: Add sale_type and status
-- ============================================================
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'retail' CHECK (sale_type IN ('retail', 'wholesale')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded'));

-- Update discount_type constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_discount_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_discount_type_check
  CHECK (discount_type IN ('amount', 'percent'));

-- ============================================================
-- 5. business_settings: Add default thresholds
-- ============================================================
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS default_low_perfume_threshold NUMERIC(12,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS default_low_bottle_threshold INTEGER DEFAULT 10;

-- ============================================================
-- 6. Index for barcode scanning performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type);
