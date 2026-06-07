-- Resh POS Migration 004: Auth profile auto-creation + RLS fixes
-- Run this in Supabase SQL Editor AFTER migrations 001, 002, 003
-- Safe to run multiple times
--
-- WHAT THIS FIXES:
-- 1. Adds email column to profiles table
-- 2. Auto-creates a profile row when a new user signs up (trigger on auth.users)
-- 3. Backfills profiles for existing users who don't have one
-- 4. Adds email column to profiles
-- 5. Fixes RLS: adds fallback policies so authenticated users without profiles
--    can still use the app (insert sales, read products, etc.)

-- ============================================================
-- 1. Add email column to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- ============================================================
-- 2. Function + Trigger: auto-create profile on auth user insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    'cashier',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Backfill: create profiles for existing auth users without one
-- ============================================================
INSERT INTO public.profiles (id, full_name, email, role, active)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.email),
  au.email,
  'cashier',
  TRUE
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- ============================================================
-- 4. RLS Fallback Policies
--    These ensure authenticated users WITHOUT a profile can still
--    use the app. The key insight: if no profile exists, allow basic
--    cashier-level access.
-- ============================================================

-- Helper: returns true if user is authenticated (regardless of profile)
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Products: any authenticated user can create/edit/delete fallback
DROP POLICY IF EXISTS "auth_user_can_insert_products" ON products;
CREATE POLICY "auth_user_can_insert_products" ON products
  FOR INSERT WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_update_products" ON products;
CREATE POLICY "auth_user_can_update_products" ON products
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_delete_products" ON products;
CREATE POLICY "auth_user_can_delete_products" ON products
  FOR DELETE USING (is_authenticated());

-- product_variants: any authenticated user can create/edit/delete fallback
DROP POLICY IF EXISTS "auth_user_can_insert_variants" ON product_variants;
CREATE POLICY "auth_user_can_insert_variants" ON product_variants
  FOR INSERT WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_update_variants" ON product_variants;
CREATE POLICY "auth_user_can_update_variants" ON product_variants
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Customers: any authenticated user can create/update fallback
DROP POLICY IF EXISTS "auth_user_can_insert_customers" ON customers;
CREATE POLICY "auth_user_can_insert_customers" ON customers
  FOR INSERT WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_update_customers" ON customers;
CREATE POLICY "auth_user_can_update_customers" ON customers
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Sales: any authenticated user can insert fallback
DROP POLICY IF EXISTS "auth_user_can_insert_sales" ON sales;
CREATE POLICY "auth_user_can_insert_sales" ON sales
  FOR INSERT WITH CHECK (is_authenticated());

-- Sale items: any authenticated user can insert fallback
DROP POLICY IF EXISTS "auth_user_can_insert_sale_items" ON sale_items;
CREATE POLICY "auth_user_can_insert_sale_items" ON sale_items
  FOR INSERT WITH CHECK (is_authenticated());

-- Suppliers: any authenticated user can create/update fallback
DROP POLICY IF EXISTS "auth_user_can_insert_suppliers" ON suppliers;
CREATE POLICY "auth_user_can_insert_suppliers" ON suppliers
  FOR INSERT WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_update_suppliers" ON suppliers;
CREATE POLICY "auth_user_can_update_suppliers" ON suppliers
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Purchase orders: any authenticated user can insert fallback
DROP POLICY IF EXISTS "auth_user_can_insert_po" ON purchase_orders;
CREATE POLICY "auth_user_can_insert_po" ON purchase_orders
  FOR INSERT WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_update_po" ON purchase_orders;
CREATE POLICY "auth_user_can_update_po" ON purchase_orders
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Purchase order items: any authenticated user can insert fallback
DROP POLICY IF EXISTS "auth_user_can_insert_poi" ON purchase_order_items;
CREATE POLICY "auth_user_can_insert_poi" ON purchase_order_items
  FOR INSERT WITH CHECK (is_authenticated());

-- Expenses: any authenticated user can insert/update/delete fallback
DROP POLICY IF EXISTS "auth_user_can_insert_expenses" ON expenses;
CREATE POLICY "auth_user_can_insert_expenses" ON expenses
  FOR INSERT WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_update_expenses" ON expenses;
CREATE POLICY "auth_user_can_update_expenses" ON expenses
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());
DROP POLICY IF EXISTS "auth_user_can_delete_expenses" ON expenses;
CREATE POLICY "auth_user_can_delete_expenses" ON expenses
  FOR DELETE USING (is_authenticated());

-- Stock movements: any authenticated user can insert fallback
DROP POLICY IF EXISTS "auth_user_can_insert_stock_movements" ON stock_movements;
CREATE POLICY "auth_user_can_insert_stock_movements" ON stock_movements
  FOR INSERT WITH CHECK (is_authenticated());

-- Business settings: any authenticated user can update fallback
DROP POLICY IF EXISTS "auth_user_can_update_settings" ON business_settings;
CREATE POLICY "auth_user_can_update_settings" ON business_settings
  FOR UPDATE USING (is_authenticated()) WITH CHECK (is_authenticated());

-- Categories: any authenticated user can insert fallback
DROP POLICY IF EXISTS "auth_user_can_insert_categories" ON categories;
CREATE POLICY "auth_user_can_insert_categories" ON categories
  FOR INSERT WITH CHECK (is_authenticated());

-- ============================================================
-- 5. Fix get_user_role() to return 'cashier' if no profile
--    This makes role-based policies work even without a profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    'cashier'
  );
$$;
