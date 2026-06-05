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

## Deployment Setup (Step 13 — Complete)

- Created `vercel.json` with framework preset, security headers, and optimal build config
- Updated `next.config.ts` with `images.remotePatterns` for Supabase storage
- Added `src/lib/env.ts` for type-safe environment variable access and build-time validation
- Created `.github/workflows/ci.yml` — CI pipeline: lint → type-check → build on every push/PR
- Updated `README.md` with comprehensive Vercel deployment guide (quick deploy, post-deploy steps, CI/CD, rollback, self-hosted options)
- Updated `.env.example` with `NEXT_PUBLIC_SITE_URL`
- Build passes (15 routes, 0 errors)
- Lint passes (0 errors, 9 pre-existing warnings)
- Ready to deploy via Vercel import from GitHub

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
