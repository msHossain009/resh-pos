-- Resh POS Database Schema
-- Run this entire file in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/_/sql

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SEQUENCES (auto-generated IDs)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS product_seq START 1;
CREATE SEQUENCE IF NOT EXISTS variant_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE SEQUENCE IF NOT EXISTS supplier_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;

-- ============================================================
-- HELPER: Get current user role from profiles
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
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

-- ============================================================
-- PRODUCT VARIANTS
-- Note: stock_quantity is in ML (milliliters) — perfume volume unit
-- ============================================================
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

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'cashier', 'viewer')) DEFAULT 'cashier',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUSINESS SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT DEFAULT 'Resh Perfumes',
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

-- ============================================================
-- CUSTOMERS
-- ============================================================
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

-- ============================================================
-- SALES
-- ============================================================
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

-- ============================================================
-- SALE ITEMS
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

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
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

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
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

-- ============================================================
-- PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPENSES
-- ============================================================
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

-- ============================================================
-- STOCK MOVEMENTS (track every inventory change)
-- ============================================================
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
-- AUDIT LOGS
-- ============================================================
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
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Drop all existing policies first (idempotent re-run)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Profiles: user reads own, admin manages all
CREATE POLICY "read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin_profile_all" ON profiles FOR ALL USING (get_user_role() = 'admin');

-- Business settings: everyone can read, admin can update
CREATE POLICY "admin_settings_write" ON business_settings FOR ALL USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "read_settings" ON business_settings FOR SELECT USING (true);

-- Categories: admin/manager write, all read
CREATE POLICY "admin_manager_cat_write" ON categories FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_cat" ON categories FOR SELECT USING (true);

-- Products: admin/manager write, all read
CREATE POLICY "admin_manager_prod_write" ON products FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_prod" ON products FOR SELECT USING (true);

-- Product variants: admin/manager write, all read
CREATE POLICY "admin_manager_var_write" ON product_variants FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_var" ON product_variants FOR SELECT USING (true);

-- Customers: admin/manager full, cashier create/read own updated
CREATE POLICY "admin_manager_cust_full" ON customers FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "cashier_cust_create" ON customers FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'manager', 'cashier'));
CREATE POLICY "cashier_cust_update" ON customers FOR UPDATE USING (get_user_role() IN ('admin', 'manager', 'cashier')) WITH CHECK (get_user_role() IN ('admin', 'manager', 'cashier'));
CREATE POLICY "read_cust" ON customers FOR SELECT USING (true);

-- Sales: admin/manager full, cashier create/read own
CREATE POLICY "admin_manager_sales_full" ON sales FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "cashier_sales_create" ON sales FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'manager', 'cashier'));
CREATE POLICY "cashier_sales_read_own" ON sales FOR SELECT USING (get_user_role() IN ('admin', 'manager', 'viewer') OR created_by = auth.uid());
CREATE POLICY "read_sale_items" ON sale_items FOR SELECT USING (true);

-- Loyalty: admin/manager write, all read
CREATE POLICY "admin_manager_loyalty_write" ON loyalty_transactions FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_loyalty" ON loyalty_transactions FOR SELECT USING (true);

-- Suppliers: admin/manager full, all read
CREATE POLICY "admin_manager_supp_full" ON suppliers FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_supp" ON suppliers FOR SELECT USING (true);

-- Purchase orders: admin/manager full, all read
CREATE POLICY "admin_manager_po_full" ON purchase_orders FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_po" ON purchase_orders FOR SELECT USING (true);
CREATE POLICY "admin_manager_poi_full" ON purchase_order_items FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_poi" ON purchase_order_items FOR SELECT USING (true);

-- Expenses: admin/manager full, all read
CREATE POLICY "admin_manager_exp_full" ON expenses FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_exp" ON expenses FOR SELECT USING (true);

-- Stock movements: admin/manager full, all read
CREATE POLICY "admin_manager_stock_full" ON stock_movements FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
CREATE POLICY "read_stock" ON stock_movements FOR SELECT USING (true);

-- Audit logs: admin/manager read, admin write
CREATE POLICY "admin_audit_full" ON audit_logs FOR ALL USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "manager_audit_read" ON audit_logs FOR SELECT USING (get_user_role() IN ('admin', 'manager'));

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_customer_spent()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers SET total_spent = total_spent + NEW.total WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_sale_update_spent ON sales;
CREATE TRIGGER after_sale_update_spent
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_spent();

CREATE OR REPLACE FUNCTION earn_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER;
BEGIN
  points_earned := FLOOR(NEW.total / 100);
  IF points_earned > 0 AND NEW.customer_id IS NOT NULL THEN
    UPDATE customers SET loyalty_points = loyalty_points + points_earned WHERE id = NEW.customer_id;
    INSERT INTO loyalty_transactions (customer_id, points, type, reference_type, reference_id, description)
    VALUES (NEW.customer_id, points_earned, 'earn', 'sale', NEW.id, 'Points earned from purchase');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_sale_loyalty ON sales;
CREATE TRIGGER after_sale_loyalty
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION earn_loyalty_points();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'cashier',
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
