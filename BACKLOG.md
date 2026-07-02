# Phoenix Finance — Backlog

Handoff point from Cowork build session to local dev (2026-07-02). Ordered by priority, not by tab.

## 🔴 Urgent — do this before using the app for real

- **No login wall.** Every page currently runs its Supabase queries server-side with the service role key regardless of who's requesting the page. RLS blocks direct anon-key access to the database, but it does **not** stop anyone with the Vercel URL from loading `/`, `/transactions`, etc. and seeing everything — because the app itself has no auth check. This is the biggest gap between "deployed" and "safe to actually use." Needs:
  - Supabase Auth set up (email/password or magic link is enough for two users).
  - Next.js middleware (`middleware.ts`) redirecting unauthenticated requests to a login page for every route.
  - Two accounts created: Lloyd, Milani.
- Until auth is in, consider turning on Vercel's **Deployment Protection** (password or Vercel-account-only access) in Project Settings so the URL isn't wide open in the meantime.

## 🟠 Core functionality gaps (v1 isn't feature-complete without these)

- **`merchant_rules` table is empty.** The categorisation engine (`lib/categorise.ts`) checks this table before falling back to Claude, but nothing has ever populated it. Write a one-off script that groups the 16,542 approved historical transactions by normalized merchant and inserts the dominant (merchant → category/sub_category/type) mapping for each. Without this, every future import goes straight to the Claude fallback for every single merchant, even ones you've categorised thousands of times before.
- **Cash-flow forecast is designed, not built.** `SOLUTION_DESIGN.md` §6 describes the logic (recurring-merchant detection for Bills/Fixed, trailing-average for Spending, scheduled Debt) — none of it is implemented. Overview tab currently only shows a deficit trend line, no forward projection.
- **`budgets` table is empty.** Budget tab will show "no targets set" for every category until you add rows (either a quick SQL insert, or build a small form in the Budget tab to set monthly targets — the second is more useful long-term).
- **`/api/import` route is untested.** It's built to handle new NAB/CBA CSV exports going forward (no Category/Sub Category columns, runs the categorisation engine), but I've never run it against a real new export. Test it with a small real file before trusting it.

## 🟡 Data quality follow-ups (deferred decisions from the taxonomy sign-off)

- 44 `pending_review` transactions (Ashby Loan, Cash Withdrawal, "Financial" category) need manual categorisation in the Categories tab.
- "Transport" vs "Car & Transport" — flagged as a merge candidate, never merged. Decide and either merge in the taxonomy or leave as-is permanently.
- Kids → Childcare sub-category — candidate to move to Bills/Fixed (it's recurring, not really discretionary spending). Not done.
- "Bills" and "Fees" are still generic catch-alls with no sub-category breakdown. Will keep surfacing as low-confidence categorisations until broken down further.
- Spending type has a lot in it (Groceries, Dining Out, Shopping, Kids, Health, etc.) — you flagged this as a candidate for an Essential vs Discretionary split. Not started.

## 🟢 UI/UX polish

- Stack was specified as shadcn/ui but the scaffold uses plain Tailwind — no shadcn components actually installed (`npx shadcn init` was never run). Worth doing properly rather than hand-rolling everything.
- Transactions and Merchants tabs are hard-capped at 100/100 rows with no pagination or search — fine for a first look, not for real use.
- No loading states, no error states anywhere.
- PWA manifest exists but there's no service worker — not actually installable yet.
- No icons in `public/manifest.json` (empty array) — needed for a proper PWA install prompt.

## ⚪ Structural / decision follow-ups

- **The combined-store decision is flagged as a live risk, not resolved.** `SOLUTION_DESIGN.md` §4 and `PRD.md` §10 both note this: you overrode the original "genuinely partitioned" requirement to move faster, ahead of the advisor conversation. If that conversation lands differently, migrating off a combined store gets harder the more data and app logic accumulate on top of it. Worth having that conversation sooner rather than later.
- Household view access model (should both partners see merged figures, or just you?) was never explicitly decided — currently there's no distinction in the code since there's no auth yet.

## Ops

- No tests exist (unit or e2e).
- No CI (lint/typecheck don't run automatically on push).
- `README.md` setup instructions haven't been verified end-to-end by actually running `npm install && npm run dev` — worth doing once you're in VS Code to catch any dependency issues.

## Reference

- Locked category taxonomy: `PRD.md` §7
- Data model: `SOLUTION_DESIGN.md` §3
- Categorisation pipeline design: `SOLUTION_DESIGN.md` §5
- v2 (Tax pack), v3 (Kubera + investment thesis engine), v4 (spending optimisation): `PRD.md` §8, noted only, not started
