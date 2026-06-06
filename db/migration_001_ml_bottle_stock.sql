-- Resh POS Migration 001: ML/Bottle Stock, Customer Type, Sale Type/Status
-- Run this in your Supabase SQL Editor after the main schema.sql

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
