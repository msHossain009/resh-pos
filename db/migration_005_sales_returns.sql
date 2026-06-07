-- Resh POS Migration 005: Sales returns tracking
-- Run this in your Supabase SQL Editor (safe to re-run)

-- ============================================================
-- 1. Add returned_quantity to sale_items for tracking partial returns
-- ============================================================
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0;

-- ============================================================
-- 2. Add return_reason to sales for cancellation/refund reasons
-- ============================================================
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- ============================================================
-- 3. Add last_returned_at to sales to track when last return happened
-- ============================================================
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS last_returned_at TIMESTAMPTZ;

-- ============================================================
-- 4. Add index for returns queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sale_items_returned_qty ON sale_items(returned_quantity);
CREATE INDEX IF NOT EXISTS idx_sales_return_reason ON sales(return_reason) WHERE return_reason IS NOT NULL;
