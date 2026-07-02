# Phoenix Finance — Product Requirements Document

**Status:** Active
**Owner:** Lloyd Thomas
**Repo:** https://github.com/Banks-source/Phoenix-Finance--Investment
**Last updated:** 2026-07-02

## 1. Summary

A personal finance app for Lloyd and Milani covering budgeting, investment tracking, and tax organisation. Not going to market — built for household use only. Replaces the current Excel-based budget workbooks (`FINANCE & INVESTMENT/PERSONAL/Budget/*.xlsx`) as the system of record.

## 2. Why

- Excel budget tracking has hit its ceiling: 4+ years of transaction history spread across four workbooks with inconsistent sheet naming, no automated categorisation, and no forward-looking cash-flow view.
- The existing category taxonomy miscategorises "Investment" as a household expense, which distorts every expense total and budget-vs-actual comparison.
- Lloyd is navigating a significant personal debt/insolvency situation (see `Finance Overview` in lloyds-brain). Accurate, real-time visibility into spending vs. fixed costs vs. debt repayment is operationally important right now, not just a nice-to-have.
- Household data needs genuine separation from Milani's financial data for reasons connected to that situation — this is a structural requirement, not a UI preference.

## 3. Goals

- Single source of truth for household transactions, replacing the Excel workbooks.
- Clean four-type category structure (Spending / Bills-Fixed / Transfers / Debt) that doesn't distort expense totals with transfers or investment capital.
- Fast, low-friction transaction categorisation with a human approval step (no silent auto-categorisation).
- Budget-vs-actual, cash-flow forecast, and deficit tracking, refreshed from live data.
- A household view that merges Lloyd's and Milani's finances for shared decision-making, while keeping her data genuinely partitioned at the data layer.

## 4. Non-goals (for now)

- Not a multi-tenant SaaS product. No onboarding flow, billing, multi-household support.
- No investment execution (v3, when built, signals trades — never auto-executes).
- No accountant-facing tax pack in v1 (that's v2).

## 5. Users

- **Lloyd** — full access to his own data and the household view.
- **Milani** — full access to her own data; her data is stored in a genuinely separate store (not a shared table filtered by owner). Partition approach to be confirmed with Lloyd's advisor before implementation — see Solution Design §4.

## 6. Data source

Raw transaction history lives on "Transactions" tabs inside the yearly Budget workbooks in Google Drive (`FINANCE & INVESTMENT/PERSONAL/Budget/`), not as standalone CSVs as originally assumed:

| Source file | Sheet | Rows | Date range |
|---|---|---|---|
| 2022-budget.xlsx | "Transactions 2023" *(mislabeled — actually 2022 data)* | 3,281 | Jan–Dec 2022 |
| 2022-budget.xlsx | "Transactions -2024" *(mislabeled — actually 2023 data)* | 3,792 | Jan–Dec 2023 |
| 2024-budget.xlsx | "Transactions" | 8,539 | Jan 2024 – Dec 2025 |
| 2026-budget-v1.2.xlsx | "New" | 974 | Jan–Mar 2026 |

**Total: 16,586 rows, Jan 2022 → Mar 2026.** Decision: import all 4.2 years as the historical baseline (not restricted to 3 years).

Schema (near-consistent across sheets, minor header drift): `Date, Amount, Account Number, Transaction Type, Transaction Details, Category, Sub Category, Merchant`.

## 7. Category taxonomy (locked 2026-07-02)

24 normalized categories mapped to four types. "Investment" and "Money Movement" move out of expenses into Transfers — this is the core fix. Ambiguous rows (Ashby Loan, Cash Withdrawal, "Financial") are marked **needs categorisation** rather than auto-assigned, surfaced in the v1 approval queue.

| Category | Txns | Net Amount | Type | Notes |
|---|---:|---:|---|---|
| Dining Out | 4,208 | -$109,371 | Spending | |
| Money Movement | 3,141 | +$144,869 | Transfers | Ashby Loan (10 txns, -$20.5K) and Cash Withdrawal (24 txns, -$18.8K) flagged needs-categorisation |
| Shopping | 2,560 | -$126,477 | Spending | |
| Groceries | 2,279 | -$101,043 | Spending | |
| Kids | 719 | -$123,268 | Spending | Childcare sub-category could later move to Bills/Fixed |
| Subscriptions | 595 | -$27,377 | Bills/Fixed | |
| Car & Transport | 545 | -$34,070 | Spending | Excludes Car Loan/Loan sub-categories, below |
| Car & Transport → Car Loan/Loan | 23 | -$26,609 | Debt | Split out of Car & Transport |
| Fees | 421 | -$3,515 | Bills/Fixed | |
| Health | 315 | -$31,464 | Spending | |
| Income | 303 | +$831,476 | *(outside the 4 types)* | Inflow |
| Rent | 200 | -$243,155 | Bills/Fixed | |
| Insurance | 195 | -$19,273 | Bills/Fixed | |
| Travel | 167 | -$23,878 | Spending | |
| Bills | 166 | -$16,384 | Bills/Fixed | Generic catch-all |
| Utilities | 160 | -$17,219 | Bills/Fixed | |
| Personal Care | 132 | -$10,525 | Spending | |
| Transport | 129 | -$6,705 | Spending | Overlaps with Car & Transport — merge candidate |
| Pets | 120 | -$10,216 | Spending | |
| Fines | 71 | -$5,891 | Spending | |
| Investment | 70 | -$62,915 | Transfers | Property capital, land tax, ASIC |
| Entertainment | 25 | -$1,656 | Spending | |
| Donations | 18 | -$589 | Spending | |
| Gambling | 14 | +$21 | Spending | |
| Financial | 10 | -$2,087 | Needs categorisation | Generic catch-all |

**Backlog:** Spending has a lot in it (Groceries, Dining Out, Shopping, Kids, Health, etc.) — candidate for a future Essential vs Discretionary split within the Spending type. Not doing this now; noted for v1.x.

**Known gap:** Lloyd's active creditor repayments (Westpac, David, Latrobe, Kia, Mike, Mum — see Debt-Paydown-Schedule) don't exist as a distinct category in the historical data. They're buried in Money Movement/Fees with generic descriptions. The approval-queue UI needs to make it easy to manually reclassify these as Debt during review, especially for 2025–2026 rows.

## 8. Phase plan

### v1 — Budget (this build, target 2–3 days)
See Solution Design for full spec. Summary: CSV/workbook import → app becomes source of truth, automated categorisation with approval step, budget-vs-actual, cash-flow forecast, deficit tracker, partitioned household view. Tabs: Overview, Budget, Categories, Transactions, Merchants.

### v2 — Tax pack (later, noted only)
- Personal tax pack first: organise and classify transactions into an accountant-ready pack (categorised, exportable, audit trail).
- Then extend to companies (Thomas Empire Pty Ltd, Thomas Group Trust) and SMSF.
- Store historical returns.
- Later: make the pack AI-queryable ("what did I claim for X in FY24?").

### v3 — Kubera integration + investment thesis engine (later, noted only)
- Integrate net-worth data from Kubera.
- Investment thesis engine anchored on Dalio / Naval / Raoul Pal frameworks.
- Deliberately challenge Lloyd's concentration/leverage bias, given the failed Tyquin St property development.
- SwyftX integration for crypto position data.
- The app **signals** trades; Lloyd executes manually. Never auto-executes.

### v4 — Spending optimisation (later, noted only)
- Alerts on spending pattern changes.
- Provider-switch recommendations (insurance, utilities, subscriptions) derived from transaction patterns.

## 9. Success criteria (v1)

- Working end-to-end (import → categorise → review → budget view) within 2–3 days.
- Excel workbooks retired as the active tracking tool.
- Milani's data verifiably isolated at the data layer (not just UI-filtered) — confirmed against the partition design before go-live.

## 10. Open questions

- **Data separation (decided 2026-07-02, flagged as a live risk):** Lloyd confirmed combining Lloyd's and Milani's data into a single store for v1, ahead of the planned advisor conversation. See Solution Design §4 — this overrides the original "genuinely partitioned, structural not UI" requirement from the initial brief. If the advisor later says real separation is needed, this will require a migration, not a config change. Revisit before the advisor conversation happens if possible.
- Account ownership rule for v1: NAB accounts → Lloyd, CBA accounts → Milani (confirmed 2026-07-02).
- Whether Childcare (under Kids) should move to Bills/Fixed — deferred.
- Whether "Bills" and "Fees" generic catch-alls should be broken down further — deferred, will surface naturally as low-confidence rows in the approval queue.
