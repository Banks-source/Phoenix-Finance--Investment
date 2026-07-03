# Phoenix Finance — Solution Design (v2: Tax)

**Status:** Draft for build · **Last updated:** 2026-07-03
**Supersedes:** the "v2 — Tax pack (noted only)" stub in `PRD.md` §8.
**Relationship to v1:** builds on the v1 Budget data model (`SOLUTION_DESIGN.md`). Same stack, same combined Supabase store, same `owner` partition rule (NAB→lloyd, CBA→milani).

---

## 1. Goal

Two outcomes, in priority order (confirmed with Lloyd 2026-07-03):

1. **FY26 personal claims builder (first).** Use the expenses already in the app to assemble Lloyd's and Milani's FY2025-26 deduction claims — tag deductible transactions, roll them up per person by ATO claim category, and export an accountant-ready pack for J. Giuffre & Co (filing deadline ~5 Jul 2026). **Personal first (Lloyd + Milani); entities come after.**
2. **Year-over-year visibility (first-class).** For every claim/expense category, show **this FY against prior FYs side by side** (FY22→FY26), so Lloyd can see "I claimed $X of accounting fees / interest / work-related last year — where am I this year?" This directly guards against missed deductions.
3. **Entity foundation + "where I stand" (second phase).** Read-only entity pages (identity + structural facts + headline P&L FY20–FY25) and a wind-up dependency view, seeded from the `tax-history/` analysis already written.

**Financial-year convention:** AU FY = 1 Jul → 30 Jun, named by end year. **FY26 = 1 Jul 2025 → 30 Jun 2026.** The app already has this in `lib/fy.ts`.

**Data reality that shapes the design:** the 16.5k transactions are **personal** NAB/CBA accounts. Entities have **no transaction data** in the app. Therefore:
- Entity P&L = the **historical tax-return figures** we extracted (annual, read-only).
- FY26 claims = **personal transactions**, each optionally tagged to the entity/property it *relates to* (e.g. Ocean Grove interest, ASIC fee → Thomas Empire). The bridge is a per-transaction tax layer, not entity bookkeeping.

---

## 2. Build order

| Phase | Scope | Delivers |
|---|---|---|
| **1** | FY26 personal claims builder + YoY category comparison | A lodgeable FY26 personal claim pack + missed-deduction visibility. **Build first.** |
| **2** | Entity foundation + where-I-stand | Entity identity/P&L pages + wind-up dependency checklist. |
| **3** | Polish: entity-tagged claims, AI-queryable ("what did I claim for X in FY24"), accountant reconciliation | Later. |

---

## 3. Data model

### Phase 1 additions

**Extend `transactions`** (migration `0002_tax_claims.sql`):
```
alter table transactions
  add column deductible   boolean,            -- null=unreviewed, true/false=decided
  add column tax_category text,               -- references tax_categories.code
  add column tax_note     text,
  add column entity_id    uuid references entities(id);  -- nullable; unused until Phase 2
```
- `deductible` is tri-state: `null` = not yet reviewed for tax, `true`/`false` = decided. Keeps the tax review separate from the v1 budget `status`.
- `tax_category` = the ATO claim bucket (below). `entity_id` is added now (nullable) to avoid a second `alter table` later.

**`tax_categories`** (reference, seeded):
```
code        text primary key,   -- e.g. 'D1_car', 'D5_work', 'rental_interest', 'accounting_fees'
label       text not null,      -- human label ('Work-related car', 'Rental — interest')
schedule    text not null,      -- 'individual' | 'rental' | 'business' | 'not_deductible'
deductible  boolean not null,
suggest_from text[]             -- internal category names that map here (e.g. {'Fees'} -> accounting_fees)
```
Seed covers the personal-return labels most relevant to Lloyd/Milani: work-related (car, travel, self-education, clothing, other D5), rental schedule (interest, rates, water, land tax, agent fees, repairs, depreciation), cost-of-managing-tax-affairs (accounting fees), gifts/donations, plus an explicit `not_deductible` bucket so Groceries/Dining never suggest as claimable.

### Phase 2 additions (migration `0003_entities.sql`)

**`entities`** — `id, slug, name, entity_type (individual|company|trust|smsf), abn, acn, tfn, status (active|winding_up|to_deregister|deregistered), role_summary, accountant, registered_address, notes`.

**`entity_relationships`** — `from_entity_id, to_entity_id, relationship (trustee_of|corporate_trustee_of|holds_units_in|director_of|beneficiary_of), detail` (e.g. "100% / 120 units", "sole director"). Encodes the dependency chain from `entity-wind-up-summary.md`.

**`entity_financials`** — `entity_id, fy, income, deductions, net_income, capital_gain, losses_carried_forward, distributions_in, distributions_out, source_doc, verified boolean`. Seeded from `claims-patterns-analysis.md` / `tyquin-st-loss-summary.md` (headline figures FY20–FY25).

**`entity_documents`** — `entity_id, fy, doc_type, path, description`. Index of the existing `tax-history/` source files.

---

## 4. FY26 claims workflow (Phase 1 core)

1. **Candidate detection.** For FY26 transactions (`date` in 1 Jul 2025–30 Jun 2026, `status='approved'`), suggest a `tax_category` via `tax_categories.suggest_from` matched on the transaction's internal `category`. Non-deductible categories (Groceries, Dining, etc.) are pre-marked `deductible=false` and hidden by default.
2. **Review surface** (`/tax/claims`): a focused queue, filterable by owner (Lloyd/Milani), showing candidate deductions. Each row: set `deductible` (y/n), pick `tax_category`, add `tax_note`. Bulk-apply by merchant (reuse the v1 merchant pattern). No silent auto-claiming — human decides, per the existing app principle.
3. **Roll-up** (`/tax` summary): per owner, per `tax_category`, sum of `deductible=true` FY26 claims → the claim total. Plus assessable income (existing logic) → net.
4. **Export.** Accountant-ready pack: claims grouped by ATO label, per person, with totals + supporting `detail`/`merchant` + (Phase 2) linked entity/document. CSV first; PDF later. Reuses the existing `/api/export` shape.

---

## 5. Year-over-year comparison (Phase 1, first-class)

A **category × financial-year matrix**, reusing v1 helpers (`getAvailablePeriods`, `fetchCategoryTotals` called per FY, `parsePeriod`):

- **Rows:** category (toggle to group by `tax_category` in the tax view, or `type`).
- **Columns:** FY22, FY23, FY24, FY25, **FY26** (current).
- **Cells:** net total for that category/FY; FY26 cell shows a **delta vs FY25** (and vs a trailing average) with up/down colour.
- **Filters:** owner (Lloyd/Milani/joint), and a "deductible only" toggle that restricts to claimable `tax_category` rows — this is the missed-deduction lens ("accounting fees: FY25 $2,100 → FY26 $0 so far").
- **Placement:** a panel on `/tax` and echoed inside the claims builder so the prior-year number sits next to the current-year claim as Lloyd reviews.

Note: FY26 is partial (through Mar 2026 in current data, plus any new imports), so YoY comparisons annotate FY26 as in-progress and optionally pro-rate for a like-for-like hint.

---

## 6. UI / routes

Rework `/tax` (currently a single personal return summary) into a hub:

| Route | Purpose | Phase |
|---|---|---|
| `/tax` | Hub: FY26 claim totals (per person) + YoY category matrix + export | 1 |
| `/tax/claims` | FY26 claims review/builder (tag deductible + tax_category) | 1 |
| `/tax/entities` | Entity list (name, type, status, losses c/f) | 2 |
| `/tax/entities/[slug]` | Entity detail: identity card, structural facts, P&L history, documents | 2 |
| `/tax/standing` | "Where I stand": wind-up dependency chain + flags checklist | 2 |

Keeps the current period selector and CSV export. Personal (Lloyd/Milani) appear as `individual`-type entities in Phase 2 so the same detail page serves people and companies.

---

## 7. Seeding

- **Phase 1:** seed `tax_categories` (static list) in the migration.
- **Phase 2:** one-off script (`scripts/seed_entities.ts`) loading `entities`, `entity_relationships`, `entity_financials`, `entity_documents` from the already-sourced figures in `tax-history/claims-patterns-analysis.md`, `tyquin-st-loss-summary.md`, `entity-wind-up-summary.md`, and each `entities/*/profile.md`. Every seeded financial carries its `source_doc` and `verified=false` until checked against the accountant's lodged copies (OCR caveat).

---

## 8. Non-goals (v2)

- No entity bookkeeping / entity bank-feed import (entity P&L is the seeded return figures only).
- No auto-claiming — every deduction is a human decision.
- No tax calculation/lodgement — the app produces a **pack for the accountant**, not an ATO lodgement.
- No change to the v1 combined-store decision (still a flagged risk — `SOLUTION_DESIGN.md` §4).

---

## 9. Open items / flags carried from tax-history

- Seeded entity figures are OCR reads of scanned ATO forms — `verified=false` until confirmed.
- Ocean Grove was purchased by **Inalaa Pty Ltd** (undocumented entity); whether the FY25/FY26 rental loss belongs on Lloyd's personal return is unresolved — surfaces as a flag on the relevant claim rows.
- Milani FY25 had ~$43k of deductions not yet traced to source — the claims builder should make her FY26 claims explicit and sourced.
