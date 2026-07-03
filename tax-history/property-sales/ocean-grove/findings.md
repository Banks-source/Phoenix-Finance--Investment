# Ocean Grove — findings (updated 2026-07-04)

**Property:** Unit 1, 91 The Avenue, Ocean Grove VIC 3226
**Owner (at sale):** Lloyd personally (La Trobe Financial loan account 40 624 426 3)
**Purchaser of record (2018):** Inalaa Pty Ltd (see flag below — now narrowed)

## Timeline, from the documents reviewed

| Date | Event | Amount |
|---|---|---|
| 26/07/18 | Original purchase — statement of adjustments prepared | Purchase price $1,025,000.00 |
| 01/08/18 | Purchase settled | Balance due to vendor $925,227.22 (after deposit + rates/water/land-tax adjustments) |
| 24/03/23 | Loan advanced (La Trobe, refinance) | $1,262,854.75 |
| Sep23–Mar24 | Property let short-term via Airbnb | 7 monthly statements collected (see below) |
| 14/07/25 | La Trobe Financial took possession (mortgagee in possession) | Loan balance ~$1,324,529.58 as at 01/07/25 |
| Jul–Nov 25 | Possession costs, legal costs, insurance, interest, late fees accrue while property held/marketed | Arrears grew to $134,348.65 by 30/11/25 |
| 29/09/25 | Property sold | $1,140,000 (per La Trobe, "market value") |
| 15/12/25 | Settlement completed | Total funds settled via PEXA: $1,188,396.43 |
| 15/12/25 | Loan closing balance after sale proceeds applied | **$292,179.82 still owed** (shortfall) |
| 26/02/26 | La Trobe's Post-MIP letter demands a repayment arrangement within 14 days or Loss Recovery action begins | — |

## ⚠️ Flag — purchase entity vs personal loan (narrowed, one question remains)

**What the documents now confirm.** The 2018 **Statement of Adjustments** (`og_purchase_statement_of_adjustments_91.pdf`, page 1) is headed verbatim: *"STATEMENT OF ADJUSTMENTS — INALAA PTY LTD from JAFFEY PTY LTD — PROPERTY: 91 THE AVENUE OCEAN GROVE — Date of Adjustment: 1 AUGUST 2018."* So the **purchaser of record was Inalaa Pty Ltd**, buying from Jaffey Pty Ltd (ACN 103 059 516, named as vendor in `og_purchase_contract_91.pdf` page 3). Purchase price $1,025,000.00; deposit $102,500.00; balance of purchase money $922,500.00; plus buyer-side adjustments $2,727.22; balance due to vendor $925,227.22.

- On the purchase **contract** particulars page the *purchaser* field is hand-completed and is **not legible under OCR** (`og_purchase_contract_91.pdf` page 3 reads as garbled characters). The clean, typed confirmation of the buyer's identity is therefore the Statement of Adjustments, which names **Inalaa Pty Ltd**.
- **Inalaa Pty Ltd is still not one of the five documented group entities** (Thomas Empire Pty Ltd, Thomas Property Management Pty Ltd, Thomic Property Pty Ltd, the SMSF trustee, or any of their trusts). There is no ASIC extract, trust deed, or unit register for Inalaa Pty Ltd anywhere in `tax-history/`.

**The one remaining question (for your accountant / your own recollection):** how did the property move from **Inalaa Pty Ltd (2018 buyer)** to **Lloyd personally (2023 refinance borrower and 2025 mortgagee-sale debtor)**? By the 2025 sale the La Trobe loan and the shortfall are unambiguously in Lloyd's personal name. A transfer from a company to an individual is itself a CGT event for the company and would reset the cost base — so this is not a cosmetic point. Without an Inalaa-to-Lloyd transfer document (not present in this folder) the cost base and the entity that actually holds any capital gain/loss cannot be stated with certainty. **I have not assumed a path.**

## Rental income — now totalled from the statements

The property ran under **two different rental regimes** in its final two years, which matters because they hit two different financial years:

### 1. Short-stay / Airbnb — FY2024 (managed by "Host on the Coast")
Seven monthly owner statements, Sep 2023 – Mar 2024 (`airbnb-rental-statements/2023-09.pdf` … `2024-03.pdf`). Each statement sub-totals RENTALS (accommodation) + FEES (cleaning recovered from guests) + TAXES (VAT) − EXPENSES (15% management fee + cleaning + one-off costs) = **net owner payout**.

| Month | Gross accommodation (RENTALS) | Net owner payout (TOTAL) |
|---|---:|---:|
| Sep 2023 | $2,509.12 | $331.63 |
| Oct 2023 | $1,436.70 | $1,236.19 |
| Nov 2023 | $3,061.89 | $2,707.61 |
| Dec 2023 | $6,646.75 | $6,059.25 |
| Jan 2024 | $4,645.05 | $4,098.29 |
| Feb 2024 | $2,449.37 | $2,231.96 |
| Mar 2024 | $1,840.00 | $1,364.00 |
| **Total (7 months)** | **$22,588.88** | **$18,028.93** |

- **Gross rental income (accommodation only): $22,588.88.** Plus cleaning fees recovered $4,730.00 and VAT $426.94 = total guest receipts $27,745.82; management/cleaning/one-off expenses were ~$9,716.89 (the reconciling difference), leaving **net cash to owner $18,028.93**.
- The Sep 2023 statement carries the one-off setup costs (\$750 onboarding, \$1,114.50 fridge replacement, cupboard locks, fridge delivery) which is why September nets almost nothing despite $2,509 of bookings. The Airbnb operation clearly **started** in Sep 2023.
- Which figure your accountant uses as "rental income" depends on their gross-vs-net convention; the deductible expenses are itemised on each statement.

### 2. Long-term tenancy — FY2025 (managed by Bellarine Property)
`og_rental_financial_summary.pdf` is a Bellarine Property folio summary (Folio OWN03353) for **1 Jul 2024 – 30 Jun 2025**: **Money In $33,325.00, Money Out $3,182.57, Balance to owner $30,142.43**, across 11 statements at ~$3,100/month. So the property was switched from Airbnb to a standard long-term tenant for its final full year. (Owner address on this folio: 29 Lang St, Coolum Beach QLD 4573 — Lloyd's current QLD address.)

### FY2025 rental result on one page — `OG.xlsx`
The `OG.xlsx` workbook (sheet "Ocean Grove") is a FY2025 rental P&L and reconciles to the Bellarine period:

| Line | Amount |
|---|---:|
| Rent | $33,142.00 |
| Interest (12 monthly charges Jul–Jun, total) | −$98,083.05 |
| Water | −$568.00 |
| Rates | −$1,723.00 |
| Agent fees | −$3,182.00 |
| Land tax | −$1,037.00 |
| **Net rental result FY2025** | **−$71,451.05** |

> ⚠️ **Discrepancy to flag:** `OG.xlsx` shows Rent $33,142.00 while the Bellarine folio shows Money In $33,325.00 (difference $183.00) and agent fees $3,182.00 vs Bellarine Money Out $3,182.57. Close, but not identical — likely a timing/rounding difference between the workbook and the agent statement. Not reconciled to the cent; your accountant should use the agent statement as the primary source.

**The FY2025 net rental LOSS of −$71,451.05** — driven by ~$98k of interest against ~$33k of rent — is the single biggest driver of Lloyd's reduced FY2025 personal taxable income (see `../../claims-patterns-analysis.md`).

## Capital position — best-effort, with assumptions labelled

The headline "$292,179.82 shortfall" is a **financing loss, not a CGT capital loss**. They are different things and it is important not to conflate them:

- **CGT capital gain/loss** compares **sale proceeds** against the **cost base** (what was paid for the asset plus acquisition and holding costs). On the face of it, the property was bought for **$1,025,000 (2018)** and sold for **$1,140,000 (2025)** — i.e. it sold for **$115,000 MORE than it was bought for**. After adding acquisition costs to the cost base and deducting selling costs, the CGT position is therefore likely **around break-even or a modest capital gain — not a large capital loss.**
- **The $292,179.82 shortfall** exists because the **loan was refinanced up to $1,262,854.75 in March 2023** (and grew with arrears/possession costs to ~$1.32M by mid-2025) — i.e. the debt was allowed to exceed the property's value. Borrowing more than the asset is worth produces a **cash/financing loss on repayment of the debt**, which is generally **not deductible and not a CGT capital loss**.

**Illustrative CGT sketch (ASSUMPTIONS — confirm every line with your accountant):**

| Item | Amount | Basis / assumption |
|---|---:|---|
| Capital proceeds | $1,140,000 | 2025 sale price (per La Trobe / PEXA) |
| less selling costs | ~−$30,000 | ASSUMED agent commission + legal/PEXA on a forced sale; **not itemised in a document reviewed** |
| = Net proceeds | ~$1,110,000 | |
| Cost base — purchase price | $1,025,000 | Statement of Adjustments 2018 |
| Cost base — stamp duty | ~$55,000 | **ASSUMED** VIC transfer duty on $1.025M (2018); actual duty **not in a document reviewed** |
| Cost base — acquisition legals/adjustments | ~$3,000 | adjustments $2,727.22 + legals (assumed) |
| Cost base — capital improvements | **unknown** | you mentioned $350K+ of capital contributed; how much was *capital works* (addable to cost base) vs *holding/refinance costs* (not addable) is **not resolved from documents** |
| = Approx cost base (excl. improvements) | ~$1,083,000 | |
| **Indicative CGT position (excl. improvements)** | **~ +$27,000 gain** | i.e. small gain, NOT a loss, before any capital works are added |

- If genuine **capital improvements** (not holding costs) were added to the cost base, the position could move from a small gain toward break-even or a modest capital loss — but the ~$292k economic loss does **not** translate into a ~$292k capital loss.
- **Whose CGT event is it?** If the asset was ever held by **Inalaa Pty Ltd** (a company), a company gets **no 50% CGT discount**, and a transfer to Lloyd would have triggered an earlier CGT event at market value. This is unresolved (see flag) and directly affects the answer.
- PEXA settlement (`pexa-settlement-completion-record.pdf`) shows loan payout $1,107,867.98 and the rates/duty/fee cheques — use it to firm up the selling-costs line above.

## Documents in this folder

Reviewed in full:
- `pexa-settlement-completion-record.pdf` — full settlement breakdown (2025 sale).
- `latrobe-shortfall-letter-2026-02-26.pdf` — the Post-MIP shortfall letter.
- `latrobe-loan-statement-2023-03-to-2025-06.pdf` — loan activity from origination to just before possession.
- `latrobe-loan-statement-2025-07-to-2025-12.pdf` — loan activity through possession, sale, and settlement.
- `og_purchase_contract_91.pdf`, `og_purchase_statement_of_account_91.pdf`, `og_purchase_statement_of_adjustments_91.pdf` — 2018 original purchase, see flag above.

Collected and **now reviewed** in this pass:
- `og_purchase_statement_of_adjustments_91.pdf` — confirms purchaser **Inalaa Pty Ltd**, price $1,025,000, balance due $925,227.22 (adj date 1 Aug 2018).
- `og_rental_financial_summary.pdf` — Bellarine Property FY2025 long-term tenancy: Money In $33,325.00 / Out $3,182.57.
- `OG.xlsx` — FY2025 rental P&L: net **−$71,451.05** (rent $33,142 vs interest −$98,083.05).
- `airbnb-rental-statements/2023-09.pdf` … `2024-03.pdf` (7 monthly statements) — totalled: gross accommodation **$22,588.88**, net owner payout **$18,028.93** (Sep 2023–Mar 2024).

Still only skimmed (loan-mechanics detail, not re-transcribed here):
- `og_latrobe_statement.pdf` (4pp) and the two dated La Trobe loan statements — loan/arrears movement already summarised in the timeline above.

## Not tax advice

Everything above is transcribed from the source documents. The actual capital loss calculation (cost base, selling costs, timing, how the shortfall debt is treated, and whether the Inalaa Pty Ltd history changes the cost-base entity) needs your accountant — this is just the organized input for that conversation.
