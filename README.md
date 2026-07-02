# Phoenix Finance

Personal finance app (budget + investment tracking + tax organisation) for Lloyd and Milani. Not a market product — household use only. This repo is the source of truth for product decisions and code.

- [`PRD.md`](./PRD.md) — what we're building and why, phased scope, locked category taxonomy.
- [`SOLUTION_DESIGN.md`](./SOLUTION_DESIGN.md) — architecture for v1, including the data-partition decision.

## Status

v1 (Budget) scaffolded: schema, taxonomy, categorisation engine, five tabs, historical backfill data (16,586 transactions, 2022–2026) ready to load. Not yet deployed. See PRD §8 for the full phase plan (v2 Tax pack, v3 Kubera/investment thesis engine, v4 spending optimisation).

## Stack

Next.js 14 + TypeScript + Tailwind + Supabase + Recharts + Claude API + Vercel. PWA, web-first.

## Setup

1. Create a Supabase project. Run `supabase/migrations/0001_init.sql` against it (via the SQL editor or `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL/keys and an Anthropic API key.
3. `npm install`
4. Backfill historical data: `npm run backfill` (loads `supabase/seed/transactions_backfill.csv`, ~16.6K rows).
5. `npm run dev` — app runs at localhost:3000.
6. Deploy to Vercel: connect this repo, set the same environment variables in the Vercel project settings.

## Data model

See `supabase/migrations/0001_init.sql` for the full schema: `accounts`, `transactions`, `categories` (seeded from the locked taxonomy), `merchant_rules` (learned from historical categorisation, used to auto-suggest on new imports), `budgets`.

## Known gaps to close before this is "done"

- Historical backfill CSV assigns `needs_categorisation` to ~44 ambiguous rows (Ashby Loan, Cash Withdrawal, "Financial" category) — these need manual review in the Categories tab after backfill.
- No auth wired up yet (Supabase Auth for Lloyd + Milani logins).
- Budget targets table is empty until you set monthly targets per category.
- Cash-flow forecast logic described in SOLUTION_DESIGN.md §6 is not yet implemented in code.
