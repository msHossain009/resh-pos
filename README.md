# Resh POS — Perfume Point of Sale System

A production-ready Point of Sale system built for Resh Perfumes.
Built with Next.js 16, TypeScript, Supabase, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL + RLS)
- **UI**: shadcn/ui (Radix primitives + Tailwind)
- **Charts**: Recharts
- **PDF**: @react-pdf/renderer
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS v4

## Features

- **Products** — Multi-variant perfume catalog with SKU, barcode, category, active/inactive management
- **Inventory** — Real-time stock tracking with low-stock alerts, stock adjustment with movement history
- **Sales/POS** — Full checkout flow with discount (amount/%), tax (from business settings), multiple payment methods (Cash, bKash, Nagad, Card, Bank Transfer), payment status (Paid/Partial/Due), loyalty points earn & redeem, stock validation & deduction, receipt printing & PDF download
- **Customers** — CRM with loyalty points, membership tiers (Regular, Silver, Gold, VIP), purchase history
- **Suppliers** — Supplier management, purchase orders with items, partial/full receive flow with automatic stock update
- **Expenses** — Track business expenses by category with monthly totals
- **Reports** — Revenue, COGS, gross/net profit, expense tracking, payment method breakdown, customer ranking, product ranking, date range filtering, CSV export
- **Dashboard** — Today's sales & profit, monthly revenue, low stock alerts, due sales alerts, 7-day revenue chart, quick actions
- **Settings** — Business name, tagline, tax rate, currency, receipt footer, theme toggle — all persisted to Supabase
- **Auth** — Email/password authentication with role-based access (admin, manager, cashier, viewer)

## Database Schema

The full PostgreSQL schema is in `db/schema.sql` and includes:

- **Tables**: products, product_variants, categories, customers, sales, sale_items, suppliers, purchase_orders, purchase_order_items, expenses, stock_movements, loyalty_transactions, business_settings, profiles, audit_logs
- **Sequences**: Auto-incrementing IDs for products, variants, invoices, customers, suppliers, purchase orders
- **RLS Policies**: Row-level security by role (admin, manager, cashier, viewer)
- **Triggers**: Auto-create profile on signup, update customer total_spent on sale, earn loyalty points on sale
- **Indexes**: Performance indexes on all foreign keys and queried columns

## Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor
3. Copy and paste the entire contents of `db/schema.sql`
4. Run the SQL — all tables, policies, sequences, and triggers will be created
5. Go to Authentication → Settings and enable email/password sign-up
6. Copy your project URL and anon key from Settings → API

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase values:

```bash
cp .env.example .env.local
```

Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run dev -- --turbo` | Dev server with Turbopack |

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features, settings, and user management |
| **Manager** | Products, inventory, sales, customers, suppliers, POs, expenses, reports |
| **Cashier** | Create sales and customers, read products/variants, view own sales |
| **Viewer** | Read-only access to all data |

Default role for new sign-ups is **cashier**. An admin can promote users via the profiles table.

## Architecture Notes

- Stock quantity is tracked in **milliliters (ml)**, not pieces
- Invoice numbers are auto-generated via PostgreSQL sequences (not frontend `Date.now()`)
- Stock movements are recorded for every inventory change (sale, purchase receive, adjustment, return, damage)
- Profit calculation uses COGS based on actual sold item cost (not current inventory valuation)
- All forms include validation and prevent duplicate submissions

## Known Limitations

- Currently supports single currency (BDT)
- No offline mode
- No barcode scanner integration (but barcode field is available)
- No multi-store / warehouse support
- No email/SMS notifications

## Deployment (Vercel — Recommended)

### Quick Deploy

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Vercel auto-detects Next.js — no build config changes needed
4. Add these environment variables in **Project Settings → Environment Variables**:

   | Variable | Scope | Value |
   |----------|-------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | All | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Your Supabase anon key |
   | `NEXT_PUBLIC_SITE_URL` | Production | `https://your-domain.vercel.app` |

5. Deploy — your app is live in ~2 minutes

### After Deployment

- **Custom domain**: Add it in Project Settings → Domains (SSL auto-provisioned)
- **Supabase allowed origins**: In Supabase Dashboard → Settings → API → set **Allowed Origins** to your production domain
- **Auth redirect URLs**: In Supabase Dashboard → Authentication → Settings → add your production URL to **Redirect URLs**
- **Connection pooling**: In Supabase Dashboard → Database → Connection Pooling, copy the pooler port (6543) URL for production use

### CI/CD

This repo includes `.github/workflows/ci.yml` — it runs lint, type check, and build on every push/PR to `master`. Add these secrets in your GitHub repo:

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

### Health Check

After deploying, visit `/api/check-config` to verify your environment variables are correctly configured.

### Rollback

If a deployment fails:
1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click the three dots → **Promote to Production**
4. For database issues, restore from Supabase Dashboard → Database → Backups

### Self-Hosted / Docker

```bash
npm run build
npm start
```

Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in your environment.
