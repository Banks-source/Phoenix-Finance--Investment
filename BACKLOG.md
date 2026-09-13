# Phoenix Finance — Backlog

Handoff point from Cowork build session to local dev (2026-07-02). Ordered by priority, not by tab.

## 🟣 Next session (queued 2026-09-13 night, mobile/UI push)

Likes the new Overview design and wants it rolled out site-wide. In priority order as given:

1. **Roll the new Overview visual style across the whole site.** Also asked: do we need a design system? Given the app is currently ad-hoc Tailwind classes (`card`, `btn-primary`, etc. in `globals.css`) with no documented tokens, worth doing a light tokens pass (colour, spacing, type scale) before extending the look everywhere — otherwise every new page reinvents it slightly differently.
2. **Bank logos on account rows** — currently a two-letter initial placeholder (`app/page.tsx`). Redbark's account payload already includes a real `institution.logo` URL (confirmed live: e.g. Westpac's), so this is just wiring, not a new integration.
3. **Add investment account balances to the cash banner, right-aligned** — "Stress Free Life" account (personal investment) and a "play account" (high risk). Placeholders for now; real numbers come from the investment/Kubera side later.
4. **Per-account recent transactions, bank-app style** — tapping an account currently jumps to a filtered `/transactions` search. Wants something that reads like each bank's own app (a proper per-account transaction list/view).
5. **Budget: add an annual view alongside the monthly one** — e.g. "$220K budget for the year — on target," not just month-by-month. `/budget` and the Overview budget card are both month-only right now.
6. **Overview needs a rethink, not a tweak.** Explicitly said the line graph (`CategoryTrendChart`) "isn't really working." Needs a real conversation about what's actually worth surfacing here before building — not just a different chart type.
7. **Open question — needs a conversation, not a silent decision: internal transfer vs. debt paydown.** He just put $25K onto the Westpac Flexi Loan (buffer account) — that's a genuine debt paydown, not a transfer. But money moving in/out of Westpac for short-term/temporary reasons should probably read as an internal transfer instead. Both look identical in the data (a transfer from NAB to Westpac) and the current rule (`lib/rules.ts`, `WESTPAC PAYMENT|TFR FROM WESTPA|\bWITHDRAWAL\b` → `Money Movement/Internal transfer`) always calls it internal — so going forward, matching NAB-side transactions need a way to distinguish "topping up the buffer" from "actually paying down the loan." Likely needs some explicit signal (amount threshold? a manual flag at entry? something else) rather than guessing from text alone — this is exactly the kind of judgement call the app's "no silent categorisation" rule exists for, so surface it for review rather than picking one automatically.

## 🔴 Urgent — do this before using the app for real

- **No login wall.** Every page currently runs its Supabase queries server-side with the service role key regardless of who's requesting the page. RLS blocks direct anon-key access to the database, but it does **not** stop anyone with the Vercel URL from loading `/`, `/transactions`, etc. and seeing everything — because the app itself has no auth check. This is the biggest gap between "deployed" and "safe to actually use." Needs:
  - Supabase Auth set up (email/password or magic link is enough for two users).
  - Next.js middleware (`middleware.ts`) redirecting unauthenticated requests to a login page for every route.
  - Two accounts created: Lloyd, Milani.
- Until auth is in, consider turning on Vercel's **Deployment Protection** (password or Vercel-account-only access) in Project Settings so the URL isn't wide open in the meantime.

## 🟠 Core functionality gaps (v1 isn't feature-complete without these)

- **Budget alert delivery is parked — no email/SMS provider configured.** `/settings/alerts` and the daily `/api/alerts/check` cron are fully built (rules, thresholds, per-category budgets, de-dup by month), but `lib/alerts/notify.ts` has nothing to actually send through: no `RESEND_API_KEY` (email) or `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` (SMS) set, so triggered alerts currently just log to the server console. Decided (2026-09-13) to park this rather than sign up for Twilio yet — SMS is pay-as-you-go (~$6 USD/month for an AU number + ~8c AUD per message, no ongoing free tier, just a one-time $15 trial credit); Resend's email free tier (3,000/month) is likely enough on its own. Pick up when ready: sign up, set the env vars in Vercel, done — no code changes needed.

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
- **Money Movement still conflates two different things: real transfers between your own accounts, and bills that happen to be paid via BPAY/internet transfer.** The BPAY/transfer catch-all rule ordering bug is fixed (specific merchant/biller rules now run first — see `lib/rules.ts`), which caught the obvious cases (AGL, Telstra, school fees, etc.), but anything paid via transfer to a payee with no matching rule still lands in Money Movement/transfers by default, and there's no way yet to tell that apart from a genuine self-transfer just by looking at one side of it. Real fix needs cross-account matching: with Kubera + Redbark now giving visibility into every account, a debit in one account matched against a same-amount credit in another within a day or two is a reliable signal of a genuine internal transfer — anything that *doesn't* match that pattern is a real (mis-filed) expense, not money movement. Not built — would need a post-import matching pass, probably surfaced as a suggestion in Review rather than auto-applied (no silent auto-categorisation, same rule as everywhere else).

## 🟢 UI/UX polish

- Stack was specified as shadcn/ui but the scaffold uses plain Tailwind — no shadcn components actually installed (`npx shadcn init` was never run). Worth doing properly rather than hand-rolling everything.
- Transactions and Merchants tabs are hard-capped at 100/100 rows with no pagination or search — fine for a first look, not for real use.
- No loading states, no error states anywhere.
- PWA manifest exists but there's no service worker — not actually installable yet.
- No icons in `public/manifest.json` (empty array) — needed for a proper PWA install prompt.

## ⚪ Structural / decision follow-ups

- **The combined-store decision is flagged as a live risk, not resolved.** `SOLUTION_DESIGN.md` §4 and `PRD.md` §10 both note this: you overrode the original "genuinely partitioned" requirement to move faster, ahead of the advisor conversation. If that conversation lands differently, migrating off a combined store gets harder the more data and app logic accumulate on top of it. Worth having that conversation sooner rather than later.
- Household view access model (should both partners see merged figures, or just you?) was never explicitly decided — currently there's no distinction in the code since there's no auth yet.

## 🔵 v2 Tax — planned (see `SOLUTION_DESIGN_TAX.md`)

**Phase 1 — FY26 personal claims builder + YoY (build first):**
- Migration `0002_tax_claims.sql`: add `deductible`, `tax_category`, `tax_note`, `entity_id` to `transactions`; create + seed `tax_categories` reference (ATO claim buckets, with `not_deductible` so Groceries/Dining never suggest).
- `/tax/claims` review surface: per-owner (Lloyd/Milani) queue of FY26 deduction candidates; set deductible + tax_category + note; bulk-by-merchant; no silent auto-claiming.
- `/tax` hub: FY26 claim totals per person + **year-over-year category matrix** (FY22→FY26, delta vs prior year, "deductible only" lens) + CSV export pack.

**Phase 2 — Entity foundation + where-I-stand:**
- Migration `0003_entities.sql`: `entities`, `entity_relationships`, `entity_financials`, `entity_documents`.
- `scripts/seed_entities.ts`: load from `tax-history/` markdown; every financial `verified=false` until checked vs accountant copies (OCR caveat).
- `/tax/entities` + `/tax/entities/[slug]` (identity, structural facts, headline P&L FY20–FY25, docs); `/tax/standing` wind-up dependency chain + flags checklist.

**Phase 3 — later:** entity-tagged claims, AI-queryable pack, accountant reconciliation.

**Flags to carry in:** seeded entity figures are OCR reads (unverified); Ocean Grove Inalaa Pty Ltd ownership unresolved (affects whether the rental loss sits on Lloyd's personal return); Milani FY25 ~$43k deductions untraced.

## Ops

- No tests exist (unit or e2e).
- No CI (lint/typecheck don't run automatically on push).
- `README.md` setup instructions haven't been verified end-to-end by actually running `npm install && npm run dev` — worth doing once you're in VS Code to catch any dependency issues.

## Reference

- Locked category taxonomy: `PRD.md` §7
- Data model: `SOLUTION_DESIGN.md` §3
- Categorisation pipeline design: `SOLUTION_DESIGN.md` §5
- v2 Tax pack design: `SOLUTION_DESIGN_TAX.md` (Phase 1 = FY26 claims + YoY; Phase 2 = entities)
- v3 (Kubera + investment thesis engine), v4 (spending optimisation): `PRD.md` §8, noted only, not started
