---
applyTo: '**'
---

# Memory

## Goal

Turn the Resh POS MVP (Next.js + TypeScript + Supabase perfume POS system at `F:\resh-pos\`) into a production-ready system with 15 areas of improvement (grouped into 10 steps), while preserving the existing UI completely.

## Progress — ALL STEPS COMPLETE ✅

### Completed Steps
1. **Database schema** — profiles, business_settings, stock_movements, audit_logs tables; role-based RLS; sequences; triggers ✅
2. **Shared types + helpers** — Product, Variant, Customer, Sale, SaleItem, Supplier, PurchaseOrder, Expense, StockMovement, BusinessSettings, UserProfile; formatCurrency, calculateSaleTotals, validateStockBeforeSale, downloadCSV, getBusinessSettings, getCurrentProfile, getCurrentUserId, can() ✅
3. **Sales/POS checkout** — Payment method dropdown, payment status (Paid/Partial/Due), discount type toggle (amount/percent), tax from settings, stock validation, stock deduction + stock_movements, loyalty redeem/burn, sale details modal with print/PDF receipt, sales history filters, shared types, getCurrentUserId for created_by ✅
4. **Receipt components** — receipt-view.tsx (print-friendly HTML), receipt-pdf.tsx (print window) with business name, tagline, invoice #, date, cashier, items, totals, payment info, footer ✅
5. **Inventory** — stock_movements tracking on adjust, movement history modal, filters (all/low/out), CSV export, search by name/SKU/barcode ✅
6. **Products** — multi-variant CRUD (add/edit/delete variants), categories from DB, barcode, active/inactive, search by name/SKU/barcode/category, mark inactive instead of delete ✅
7. **Suppliers/PO** — edit supplier, PO items with variant selection, PO details modal, partial/full receive flow (updates stock + stock_movements), cancel PO ✅
8. **Expenses** — NEW page + sidebar entry, CRUD with validation, filters (date, category, payment), monthly total card, CSV export, categories (Rent/Salary/Marketing/Packaging/Delivery/Utility/Misc) ✅
9. **Reports** — date range filter (Today/7d/30d/This Month/Custom), correct COGS (from sold item cost), gross profit, expenses total, net profit, revenue, discount, tax, transactions, avg order value, 7-day chart, payment breakdown pie, top products, customer ranking, low stock alert, CSV export ✅
10. **Dashboard** — today sales & profit (COGS-based), today discount, month revenue & expenses, profit, low stock + out of stock alerts, due sales alerts, pending PO alerts, 7-day revenue chart (Recharts), recent sales with payment status badges, quick actions (New Sale/Add Product/Add Expense/New PO) ✅
11. **Customers** — customer details modal, purchase history, loyalty transaction history, membership tiers (Regular/Silver/Gold/VIP) with progress bar, duplicate email/phone warning, due balance, manual loyalty adjustment ✅
12. **Settings** — loads/saves to Supabase business_settings, business name, tagline, currency, tax rate, receipt footer, theme toggle, export settings ✅
13. **Roles** — user profile loaded in TopBar with role badge, `can(role, action)` helper utility for role-based UI hiding ✅
14. **README + .env.example** — comprehensive README with tech stack, features, schema, setup guide, commands, roles, architecture notes, limitations; .env.example already existed ✅
15. **Lint + Build** — `npm run build` passes, all 15 routes compile and prerender ✅

## Deployment Setup (Step 13 — PR Merged ✅)

- Created `vercel.json` with framework preset, security headers, and optimal build config
- Updated `next.config.ts` with `images.remotePatterns` for Supabase storage
- Added `src/lib/env.ts` for type-safe environment variable access and build-time validation
- Created `.github/workflows/ci.yml` — CI pipeline: lint → type-check → build on every push/PR to master
- Updated `README.md` with comprehensive Vercel deployment guide (quick deploy, post-deploy steps, CI/CD, rollback, self-hosted options)
- Updated `.env.example` with `NEXT_PUBLIC_SITE_URL`
- Build passes (15 routes, 0 errors) with empty env vars
- Lint passes (0 errors, 9 pre-existing warnings)
- PR #2 (`deploy/vercel-setup` → `master`) created and merged — branch deleted
- GitHub CLI (v2.93.0) installed and authenticated on dev machine

### Status — ALL DONE ✅

- GitHub Actions secrets added (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL)
- CI run on master: ✅ success
- Vercel deployment live at https://resh-pos.vercel.app — returns HTTP 200

## Key Info
- Stock quantity is in **ml** (milliliters) not pieces
- Invoice numbers auto-generated via PostgreSQL sequences
- Profit uses COGS from actual sold item cost
- 15 routes: /, /products, /inventory, /sales, /customers, /suppliers, /expenses, /reports, /settings, /auth/login, /auth/signup, /api/check-config
- Schema at `db/schema.sql`
- Types at `src/lib/types/index.ts`
- Utils at `src/lib/utils.ts`
- Helpers at `src/lib/helpers.ts`
- Receipt components at `src/components/receipt/`
- Payments: Cash, bKash, Nagad, Card, Bank Transfer

## Logo/Branding (June 6, 2026)

- Downloaded official Resh logo from https://reshbangladesh.com/wp-content/uploads/2025/04/png-2.png
- Saved locally to `public/resh-logo.png` (8.4KB)
- Replaced the "R" icon + "Resh POS" text in sidebar brand area with the logo image
- Uses Next.js `<Image>` component with `priority`, width 110, height 36
- Alt text: "Resh Logo"
- No other UI or feature changes
- Build + lint pass clean (0 errors)

## Massive Overhaul — Ml/Bottle Stock, Sales, Reports, UX (June 6, 2026)

### Database Migration (`db/migration_001_ml_bottle_stock.sql`)
- Added to `product_variants`: `stock_ml` (numeric), `low_stock_ml_threshold`, `bottle_stock_qty`, `low_bottle_threshold`, `retail_price`, `retail_cost`, `wholesale_price_per_ml`, `wholesale_cost_per_ml`
- Added to `stock_movements`: `perfume_ml_change`, `bottle_qty_change`, `previous_perfume_ml`, `new_perfume_ml`, `previous_bottle_qty`, `new_bottle_qty`, `cancel_return` type
- Added `customer_type` to `customers`, `sale_type`/`status` to `sales`
- Added `default_low_perfume_threshold`/`default_low_bottle_threshold` to `business_settings`
- Added indexes for barcode and status

### All 10 Dashboard Pages Updated
- **Products** — Default variant generation (6/15/30/50/100ml), retail/wholesale pricing, ml+bottle stock fields, category+status filters, CSV export
- **Sales** — Barcode scan input, retail/wholesale mode toggle, customer type auto-detection, wholesale ml/bottle qty per item, cancel sale with stock return, invoice print/PDF, sale type/status filters
- **Inventory** — ml+bottle stock with threshold info, risk badges (perfume: Safe/Low/Out, bottles: OK/Low/Out), 4 alert cards, movement history shows ml/bottle changes
- **Customers** — Added `customer_type` (retail/wholesale) with badge and filter
- **Dashboard** — 4 distinct colored cards with left border accents, profit/loss indicators, stock alerts for perfume AND bottles, quick actions
- **Reports** — Accurate COGS from sold item cost, cancelled sales excluded, profit margin badges, product profit ranking, retail vs wholesale breakdown pie chart, additional filters
- **Settings** — Default perfume/bottle threshold fields, improved save with fallback insert
- **Expenses** — No changes needed (already functional)
- **Suppliers** — No changes needed (already functional)

### Type System (`src/lib/types/index.ts`)
- Updated `Variant`, `Sale`, `Customer`, `StockMovement`, `CartItem`, `BusinessSettings` with new fields
- Added `getPerfumeStockRisk()`, `getBottleStockRisk()`, `StockRiskLevel` type

### Constants & Utils
- `src/lib/constants.ts` — Added `DEFAULT_VARIANT_SIZES`, `LOW_PERFUME_ML_THRESHOLD`, `LOW_BOTTLE_THRESHOLD`, `SALE_TYPES`, `SALE_STATUSES`, `CUSTOMER_TYPES`
- `src/lib/utils.ts` — Updated `validateStockBeforeSale()` for ml+bottle retail vs wholesale checks

### Lint & Build
- Fixed 7 ESLint errors (set-state-in-effect, unused vars, hoisting, unescaped entities)
- Fixed 8 ESLint warnings (exhaustive-deps: added useCallback + proper deps arrays)
- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — passes (15 routes, 0 errors)

### Key Patterns
- Data fetching: extract pure query function (no setState) with `useCallback`, call from effect's local async function
- Avoid `setState` inside useEffect bodies — use eslint-disable comments for the `react-hooks/set-state-in-effect` rule where unavoidable
- All shared fetch functions wrapped in `useCallback([supabase, ...filterDeps])` for stable references
- `addToCart` must be defined before `handleBarcodeSearch` (hoisting fix)
- `useCallback` removed where function only used in event handlers (not passed as prop)
- `mounted` state removed from Settings — replaced by `loading` state alone
- `wholesaleMlInputs`/`bottleQtyInputs` removed from Sales (unused state)
