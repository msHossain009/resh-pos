-- Resh POS Migration 003: Row-Level Security Policies
-- Run this in Supabase SQL Editor AFTER migrations 001 and 002
-- This is safe to run multiple times (idempotent)

-- ============================================================
-- BOOTSTRAP: Ensure profiles table exists (referenced by get_user_role)
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
-- 1. Enable RLS on all tables (safe to re-run)
-- ============================================================
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Helper function: get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 3. RLS Policies (drop + recreate for idempotency)
-- ============================================================

-- Profiles: user reads own, admin manages all
DROP POLICY IF EXISTS "read_own_profile" ON profiles;
CREATE POLICY "read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "admin_profile_all" ON profiles;
CREATE POLICY "admin_profile_all" ON profiles FOR ALL USING (get_user_role() = 'admin');

-- Business settings: everyone can read, admin can update
DROP POLICY IF EXISTS "admin_settings_write" ON business_settings;
CREATE POLICY "admin_settings_write" ON business_settings FOR ALL USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
DROP POLICY IF EXISTS "read_settings" ON business_settings;
CREATE POLICY "read_settings" ON business_settings FOR SELECT USING (true);

-- Categories: admin/manager write, all read
DROP POLICY IF EXISTS "admin_manager_cat_write" ON categories;
CREATE POLICY "admin_manager_cat_write" ON categories FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_cat" ON categories;
CREATE POLICY "read_cat" ON categories FOR SELECT USING (true);

-- Products: admin/manager write, all read
DROP POLICY IF EXISTS "admin_manager_prod_write" ON products;
CREATE POLICY "admin_manager_prod_write" ON products FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_prod" ON products;
CREATE POLICY "read_prod" ON products FOR SELECT USING (true);

-- Product variants: admin/manager write, all read
DROP POLICY IF EXISTS "admin_manager_var_write" ON product_variants;
CREATE POLICY "admin_manager_var_write" ON product_variants FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_var" ON product_variants;
CREATE POLICY "read_var" ON product_variants FOR SELECT USING (true);

-- Customers: admin/manager full, cashier create/read/update
DROP POLICY IF EXISTS "admin_manager_cust_full" ON customers;
CREATE POLICY "admin_manager_cust_full" ON customers FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "cashier_cust_create" ON customers;
CREATE POLICY "cashier_cust_create" ON customers FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'manager', 'cashier'));
DROP POLICY IF EXISTS "cashier_cust_update" ON customers;
CREATE POLICY "cashier_cust_update" ON customers FOR UPDATE USING (get_user_role() IN ('admin', 'manager', 'cashier')) WITH CHECK (get_user_role() IN ('admin', 'manager', 'cashier'));
DROP POLICY IF EXISTS "read_cust" ON customers;
CREATE POLICY "read_cust" ON customers FOR SELECT USING (true);

-- Sales: admin/manager full, cashier create + read own
DROP POLICY IF EXISTS "admin_manager_sales_full" ON sales;
CREATE POLICY "admin_manager_sales_full" ON sales FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "cashier_sales_create" ON sales;
CREATE POLICY "cashier_sales_create" ON sales FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'manager', 'cashier'));
DROP POLICY IF EXISTS "cashier_sales_read_own" ON sales;
CREATE POLICY "cashier_sales_read_own" ON sales FOR SELECT USING (get_user_role() IN ('admin', 'manager', 'viewer') OR created_by = auth.uid());

-- Sale items: admin/manager full, read for all authenticated
DROP POLICY IF EXISTS "admin_manager_si_full" ON sale_items;
CREATE POLICY "admin_manager_si_full" ON sale_items FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_sale_items" ON sale_items;
CREATE POLICY "read_sale_items" ON sale_items FOR SELECT USING (true);

-- Loyalty: admin/manager write, all read
DROP POLICY IF EXISTS "admin_manager_loyalty_write" ON loyalty_transactions;
CREATE POLICY "admin_manager_loyalty_write" ON loyalty_transactions FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_loyalty" ON loyalty_transactions;
CREATE POLICY "read_loyalty" ON loyalty_transactions FOR SELECT USING (true);

-- Suppliers: admin/manager full, all read
DROP POLICY IF EXISTS "admin_manager_supp_full" ON suppliers;
CREATE POLICY "admin_manager_supp_full" ON suppliers FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_supp" ON suppliers;
CREATE POLICY "read_supp" ON suppliers FOR SELECT USING (true);

-- Purchase orders: admin/manager full, all read
DROP POLICY IF EXISTS "admin_manager_po_full" ON purchase_orders;
CREATE POLICY "admin_manager_po_full" ON purchase_orders FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_po" ON purchase_orders;
CREATE POLICY "read_po" ON purchase_orders FOR SELECT USING (true);

-- Purchase order items: admin/manager full, all read
DROP POLICY IF EXISTS "admin_manager_poi_full" ON purchase_order_items;
CREATE POLICY "admin_manager_poi_full" ON purchase_order_items FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_poi" ON purchase_order_items;
CREATE POLICY "read_poi" ON purchase_order_items FOR SELECT USING (true);

-- Expenses: admin/manager full, all read
DROP POLICY IF EXISTS "admin_manager_exp_full" ON expenses;
CREATE POLICY "admin_manager_exp_full" ON expenses FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_exp" ON expenses;
CREATE POLICY "read_exp" ON expenses FOR SELECT USING (true);

-- Stock movements: admin/manager full, all read
DROP POLICY IF EXISTS "admin_manager_stock_full" ON stock_movements;
CREATE POLICY "admin_manager_stock_full" ON stock_movements FOR ALL USING (get_user_role() IN ('admin', 'manager')) WITH CHECK (get_user_role() IN ('admin', 'manager'));
DROP POLICY IF EXISTS "read_stock" ON stock_movements;
CREATE POLICY "read_stock" ON stock_movements FOR SELECT USING (true);

-- Audit logs: admin full, manager read
DROP POLICY IF EXISTS "admin_audit_full" ON audit_logs;
CREATE POLICY "admin_audit_full" ON audit_logs FOR ALL USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');
DROP POLICY IF EXISTS "manager_audit_read" ON audit_logs;
CREATE POLICY "manager_audit_read" ON audit_logs FOR SELECT USING (get_user_role() IN ('admin', 'manager'));
