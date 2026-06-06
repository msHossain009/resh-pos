-- Resh POS Migration 002: Sale item cost snapshots, invoice sequence, demo data support
-- Run this in your Supabase SQL Editor AFTER migration_001_ml_bottle_stock.sql

-- ============================================================
-- 1. sale_items: Add cost snapshots, ml/bottle sold fields
-- ============================================================
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS perfume_ml_sold NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bottle_qty_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_profit NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS variant_size_ml_snapshot NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_ml_sold NUMERIC(12,2) DEFAULT 0;

-- ============================================================
-- 2. is_demo column for safe demo data management
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE products ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE product_variants ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE expenses ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'is_demo'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 3. Invoice number auto-generation sequence
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1 INCREMENT 1;

-- Create or replace function to auto-generate invoice_no
CREATE OR REPLACE FUNCTION generate_invoice_no()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_no_seq')::TEXT, 4, '0');
$$;

-- Trigger to auto-set invoice_no on sales insert
CREATE OR REPLACE FUNCTION set_invoice_no()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := generate_invoice_no();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_no ON sales;
CREATE TRIGGER trg_set_invoice_no
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_no();

-- ============================================================
-- 4. Purchase order number auto-generation sequence
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS po_no_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_po_no()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('po_no_seq')::TEXT, 4, '0');
$$;

CREATE OR REPLACE FUNCTION set_po_no()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := generate_po_no();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_po_no ON purchase_orders;
CREATE TRIGGER trg_set_po_no
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_po_no();

-- ============================================================
-- 5. Add status column to products if not exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'cancelled'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'status'
  ) THEN
    ALTER TABLE product_variants ADD COLUMN status TEXT DEFAULT 'active'
      CHECK (status IN ('active', 'inactive', 'cancelled'));
  END IF;
END $$;

-- ============================================================
-- 6. Add indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant_id ON sale_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_products_is_demo ON products(is_demo);
CREATE INDEX IF NOT EXISTS idx_sales_is_demo ON sales(is_demo);

-- ============================================================
-- 7. Update existing sale_items with cost data from variants
-- ============================================================
UPDATE sale_items si
SET
  unit_cost = COALESCE(pv.retail_cost, pv.cost, 0),
  line_cost = COALESCE(pv.retail_cost, pv.cost, 0) * si.quantity,
  line_profit = si.subtotal - (COALESCE(pv.retail_cost, pv.cost, 0) * si.quantity),
  perfume_ml_sold = si.quantity * COALESCE(pv.size_ml, 0),
  bottle_qty_sold = si.quantity,
  product_name_snapshot = COALESCE(p.name, ''),
  variant_size_ml_snapshot = COALESCE(pv.size_ml, 0)
FROM sale_items si2
JOIN product_variants pv ON pv.id = si2.variant_id
LEFT JOIN products p ON p.id = pv.product_id
WHERE si.id = si2.id AND (si.unit_cost = 0 OR si.unit_cost IS NULL);
