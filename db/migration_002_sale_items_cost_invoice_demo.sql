-- Resh POS Migration 002: Sale item cost snapshots, invoice sequence, demo data support
-- Run this in your Supabase SQL Editor AFTER migration_001 (standalone — creates missing tables)

-- ============================================================
-- BOOTSTRAP: Ensure all referenced tables exist
-- Safe to re-run; uses IF NOT EXISTS everywhere
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT,
  date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'burn')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT UNIQUE NOT NULL DEFAULT ('PO-' || LPAD(NEXTVAL('po_seq')::TEXT, 4, '0')),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partially Received', 'Received', 'Cancelled')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT CHECK (action IN ('create', 'update', 'delete', 'refund', 'receive_stock', 'adjust_stock')),
  old_data JSONB,
  new_data JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_demo') THEN
    ALTER TABLE products ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name = 'is_demo') THEN
    ALTER TABLE product_variants ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'is_demo') THEN
    ALTER TABLE customers ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'is_demo') THEN
    ALTER TABLE suppliers ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'is_demo') THEN
    ALTER TABLE expenses ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'is_demo') THEN
    ALTER TABLE sales ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'is_demo') THEN
    ALTER TABLE sale_items ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 3. Invoice number auto-generation sequence
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_invoice_no()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_no_seq')::TEXT, 4, '0');
$$;

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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'status') THEN
    ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name = 'status') THEN
    ALTER TABLE product_variants ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled'));
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
-- Safely checks for retail_cost column before running
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_variants' AND column_name = 'retail_cost'
  ) THEN
    UPDATE sale_items si
    SET
      unit_cost = COALESCE(pv.retail_cost, pv.cost, 0),
      line_cost = COALESCE(pv.retail_cost, pv.cost, 0) * si.quantity,
      line_profit = si.subtotal - (COALESCE(pv.retail_cost, pv.cost, 0) * si.quantity),
      perfume_ml_sold = si.quantity * COALESCE(pv.size_ml, 0),
      bottle_qty_sold = si.quantity,
      product_name_snapshot = COALESCE(p.name, ''),
      variant_size_ml_snapshot = COALESCE(pv.size_ml, 0)
    FROM product_variants pv
    LEFT JOIN products p ON p.id = pv.product_id
    WHERE si.variant_id = pv.id AND (si.unit_cost IS NULL OR si.unit_cost = 0);
  END IF;
END $$;
