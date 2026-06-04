-- Resh POS Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create sequences for auto-generated IDs
CREATE SEQUENCE IF NOT EXISTS product_seq START 1;
CREATE SEQUENCE IF NOT EXISTS variant_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE SEQUENCE IF NOT EXISTS supplier_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;

-- 3. Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  barcode TEXT UNIQUE DEFAULT ('PRD-' || LPAD(NEXTVAL('product_seq')::TEXT, 4, '0')),
  category_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Product variants (sizes + concentrations)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_ml NUMERIC(8,2) NOT NULL DEFAULT 50,
  concentration TEXT DEFAULT 'EDP',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  sku TEXT UNIQUE DEFAULT ('VAR-' || LPAD(NEXTVAL('variant_seq')::TEXT, 4, '0')),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Customers table
CREATE TABLE customers (
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

-- 7. Sales table
CREATE TABLE sales (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Sale items table
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Loyalty transactions
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'burn')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Purchase orders table
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT UNIQUE NOT NULL DEFAULT ('PO-' || LPAD(NEXTVAL('po_seq')::TEXT, 4, '0')),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partially Received', 'Received', 'Cancelled')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Purchase order items (when fully implemented)
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT,
  date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_variant ON sale_items(variant_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users full access
CREATE POLICY "Allow all for authenticated" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON loyalty_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function to update total_spent on customer
CREATE OR REPLACE FUNCTION update_customer_spent()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers SET total_spent = total_spent + NEW.total WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_sale_update_spent
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_spent();

-- Function to earn loyalty points (1 point per 100 BDT)
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

CREATE TRIGGER after_sale_loyalty
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION earn_loyalty_points();
