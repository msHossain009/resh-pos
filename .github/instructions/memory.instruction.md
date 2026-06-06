---
applyTo: '**'
---

# Resh POS — Persistent Memory

## Project
Perfume/attar POS web app: Next.js 16, TypeScript, Supabase, Tailwind 4, Radix UI, Recharts.

## Stock Model
- Perfume tracked in **ml** (not pieces) via `stock_ml` on `product_variants`
- Bottle stock tracked separately via `bottle_stock_qty`
- Retail: fixed bottle sizes (6/15/30/50/100ml), deducts ml + bottle qty
- Wholesale: dynamic ml input, price per ml, optional bottle deduction

## Key Patterns
- `"use client"` pages use `createClient()` from `@/lib/supabase/client`
- Use `useCallback` for shared fetch functions, define BEFORE the `useEffect` that calls them
- For set-state inside effects: extract pure query functions with `useCallback`, call from local async inside effect
- Separate re-fetch functions for click handlers (no ESLint conflict)
- `addToCart` must be defined before `handleBarcodeSearch` (hoisting)

## Database Migrations
- `db/migration_001_ml_bottle_stock.sql` — Run FIRST: adds ml/bottle fields, customer_type, sale_type/status
- `db/migration_002_sale_items_cost_invoice_demo.sql` — Run SECOND: adds cost snapshots to sale_items, is_demo columns, invoice/PO auto-generation triggers, product/variant status

## Implemented Features (all functional with Supabase):

### Products (`/products`)
- Add/Edit product with variants (6/15/30/50/100ml defaults)
- Generate Default Variants button
- Per-variant: size_ml, concentration, SKU, barcode, retail/wholesale pricing, ml+bottle stock, thresholds
- Search (name, SKU, barcode), category filter, status filter
- CSV export
- Status toggle (Active/Inactive)

### Inventory (`/inventory`)
- Dual ml+bottle stock display with thresholds
- Risk badges: Safe/Low/Out for perfume and bottles
- 4 alert cards (out perfume, low perfume, out bottles, low bottles)
- Adjust dialog: set perfume ml + bottle qty + reason
- Movement history dialog showing ml and bottle changes
- Stock risk filters, CSV export

### Sales/POS (`/sales`)
- New Sale dialog with retail/wholesale mode toggle
- Customer auto-sets sale type (retail/wholesale)
- Barcode scan input with Barcode icon + keyboard Enter
- Product search with inline picker
- Cart with qty (retail) or ml+bottle qty (wholesale) inputs
- Discount (amount/percent), tax from settings
- Payment: Cash/bKash/Nagad/Card/Bank Transfer
- Payment status: Paid/Partial/Due
- Loyalty points redeem
- Cancel sale with stock return (`cancel_return` stock movements)
- Invoice print + PDF (print window)
- Sale items store cost snapshots (unit_cost, line_cost, line_profit) at time of sale
- Sale items store perfume_ml_sold, bottle_qty_sold, product_name_snapshot

### Customers (`/customers`)
- Add/Edit customer with type (retail/wholesale)
- Customer details modal with purchase history, loyalty history
- Loyalty points adjustment
- Membership tiers (Regular/Silver/Gold/VIP)
- Due amount calculation
- CSV export

### Suppliers (`/suppliers`)
- Add/Edit supplier
- Purchase Orders: create with line items, select variant
- PO receive: updates stock_ml AND bottle_stock_qty (fixed from legacy stock_quantity only)
- PO receive creates stock_movements with perfume_ml_change + bottle_qty_change
- PO status: Pending/Partially Received/Received/Cancelled
- PO details modal
- CSV export for suppliers and POs

### Expenses (`/expenses`)
- Add/Edit/Delete expense
- Filters: date range, category, payment method
- Monthly total card
- CSV export

### Reports (`/reports`)
- Accurate COGS: uses sale_items cost snapshots (unit_cost/line_cost at time of sale), falls back to variant cost
- Cancelled sales EXCLUDED from revenue/profit calculations
- Summary cards: Revenue, COGS, Gross Profit, Expenses, Net Profit
- Charts: revenue by day, payment breakdown, order type, retail vs wholesale
- Rankings: top products (revenue + profit), top customers
- Low stock alert
- Filters: date range, customer, customer type, sale type, order type, payment, status
- CSV export

### Dashboard (`/`)
- 4 KPI cards: Today's Sales, Month Revenue, Products/Customers, Stock Alerts
- Left border colors (gold, blue, purple, amber)
- Profit/loss indicators with TrendingUp/TrendingDown
- Stock alerts for perfume AND bottles
- Recent sales table
- 7-day revenue chart
- Quick actions: New Sale, Add Product, Add Expense, New PO
- Filters: date range (Today/This Week/This Month/7d/30d/Custom), customer, customer type, sale type, order type
- Apply button to refresh

### Settings (`/settings`)
- Business info, tax rate, receipt footer saved to Supabase
- Stock defaults (low perfume threshold, low bottle threshold)
- Theme toggle (light/dark)
- Demo Data management:
  - Add Demo Data: 7 products with 35 variants, 5 customers, 3 suppliers, 6 expenses
  - Remove Demo Data: safely deletes only is_demo=true records
  - All demo data marked with is_demo flag

## Common Issues
- `useCallback` must be imported everywhere it's used
- Badge variants: default, secondary, destructive, outline, gold, success, warning
- Lucide-react does NOT export `Bottle` — use `BottleWine`
- Dashboard uses `dynamic = "force-dynamic"` on layout (Supabase SSR fix)
- Date filter uses `sale_type` on sales table, not `customers.customer_type`

## Migration Fixes (Session 3 — self-contained rewrites)
- **Migration 001**: Now fully self-contained. Adds a bootstrap section that creates ALL referenced tables (`categories`, `products`, `product_variants`, `business_settings`, `customers`, `sales`, `stock_movements`) plus all sequences using `CREATE TABLE IF NOT EXISTS`. No dependency on `schema.sql`. Handles missing `stock_movements` table.
- **Migration 002**: Fully self-contained. Creates `sale_items`, `suppliers`, `expenses`, `loyalty_transactions`, `purchase_orders`, `purchase_order_items`, `audit_logs` if missing. The final UPDATE query wrapped in a `DO $$` block that checks for `retail_cost` column existence before running (fixes `42703` error).
- **Migration 003**: Now creates `profiles` table with `CREATE TABLE IF NOT EXISTS` at the top before the `get_user_role()` function references it (fixes `42P01` error).
- All migrations use `IF NOT EXISTS` / `IF EXISTS` throughout — safe to re-run.

## Bug Fixes (Session 3)
- Sales page: Added `!== "all"` guards on all 5 Supabase filter conditions (customer, payment, order type, sale type, status)
- Settings page: Added "Reset Demo Data" button that removes existing demo data and re-adds fresh

## Build Status
- npm run lint: 0 errors, 0 warnings
- npm run build: passes, 12 routes, 0 errors

## Connected Supabase
- Project ref: `vvyxgozocdgxxpfmwonj`
- Supabase CLI linked and logged in with PAT
- All 3 migrations successfully executed on the remote database
- `.env.local` configured with real project URL + anon key (kept in .gitignore)
- Supabase project directory initialized at `F:\resh-pos\supabase/`

## Completed (This Session — Supabase setup + E2E testing)
1. **Configured .env.local** with real Supabase URL and anon key
2. **Installed Supabase CLI** (v2.105.0) and linked the project
3. **Fixed migration_001** — Added missing column bootstrap for pre-existing tables:
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all columns that CREARE TABLE IF NOT EXISTS skips
   - UNIQUE constraints added separately after column creation (avoid timing issues)
   - NULL barcode/SKU values filled before adding UNIQUE constraints
4. **Ran all 3 migrations** successfully on the remote Supabase database (0 errors)
5. **E2E backend test** — 56/56 tests pass (all 15 tables exist, all columns verified)
6. **Build passes** cleanly (12 routes, 0 lint errors, 0 build errors)
7. Config check API returns OK

## Migration Fix (Session 4)
- Columns in CREATE TABLE IF NOT EXISTS are NOT added if table already exists — must use explicit `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN ... UNIQUE` can fail — add column first without UNIQUE, update values, then add constraint separately
- The `scripts/` directory used for temporary tests was cleaned up

## Pending (Browser-based E2E testing)
- Start dev server (`npm run dev`) and test all pages in browser:
  - Products: CRUD operations, variant management
  - Sales/POS: create sale with barcode, cancel sale
  - Inventory: adjust stock, view risk badges
  - Customers: add customer with loyalty points
  - Suppliers: create purchase order, receive
  - Expenses: CRUD
  - Reports: verify COGS accuracy
  - Dashboard: verify KPIs and filters
  - Settings: add demo data, business info
