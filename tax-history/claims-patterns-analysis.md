# Claims & patterns analysis — year over year

**Prepared:** 2026-07-04 · **For:** the accountant (J. Giuffre & Co) and Lloyd/Milani's own reference
**This is reference material assembled from the source files — not tax or financial advice.**

**Scope:** what was actually earned, claimed, distributed, and carried forward across the personal returns (Lloyd Thomas, Milani Simic) and the family entities, FY2020→FY2025. Every figure cites its source file. Where a number was read by OCR from a scanned ATO form box it is flagged — those are the least reliable digits in the whole set.

> **Financial-year convention:** an Australian FY runs 1 Jul → 30 Jun and is named by its **end** year. "FY2025" here = the year ended **30 June 2025**. (Note this is *not* the same as the app's "FY2025-26" planning year, which ends 30 June 2026.)

---

## 1. Lloyd Thomas — personal, year over year

| FY | Gross salary/wages | PAYG withheld | Super (SG etc.) | Taxable income (assessed) | Source |
|---|---:|---:|---:|---:|---|
| 2022 | $183,446.51 | $56,680 | $20,078.01 (incl RESC $1,733.26) | — | `personal/lloyd/2022/lloyd_ato_2022.pdf` |
| 2023 | $184,993.47 | $57,284 | $19,424.30 | — | `personal/lloyd/2023/lloyd_income_statement_fy2023.pdf` |
| 2024 | $196,873.60 (base $165,171.37 + bonus $16,516.31 + leave $15,185.92) | $63,030 | $21,656.08 | — | `personal/lloyd/2024/lloyd_income_statement_fy2024.pdf` |
| 2025 | $222,418.20 (base $185,198.19 + bonus $23,064.69 + leave $14,471.58 − salsac $316.26) | $73,084 | $26,167.34 | **$158,335** | `personal/lloyd/2025/lloyd_payg_2025.pdf`; `.../lloyd_fy2025_tax_assessment.pdf` |

**Employment income trend:** steadily rising — ~$183k → $185k → $197k → **$222k gross** over four years. On employment alone, Lloyd's taxable income should have been *rising*.

### 🔎 Call-out — FY2025 is the odd year out for Lloyd

For FY2022–FY2024 Lloyd's returns look like a straightforward PAYG salary earner: taxable income tracks gross wages, with little else moving the number. **FY2025 breaks that pattern sharply:**

- **Gross wages $222,418** but **assessed taxable income only $158,335** — a gap of roughly **$64,083** of deductions/losses pulling taxable income *below* gross for the first time.
- The FY2025 assessment (`lloyd_fy2025_tax_assessment.pdf`) shows tax $39,921.95 + Medicare $3,166.70, PAYG credits $73,084 → a **refund of $30,013.35**. In the prior salary-only years there was no comparable large negative offset.
- **The driver is almost entirely the Ocean Grove rental loss of −$71,451.05** (see `property-sales/ocean-grove/findings.md` and `OG.xlsx`): ~$98k of loan interest against ~$33k of rent produced a large negative rental result that flowed into Lloyd's personal return. This is a **negatively-geared property loss**, not a change in his employment.

**Why this matters:** the FY2025 refund is real but it depends on the Ocean Grove loss being correctly claimable in Lloyd's personal name. Given the open question over whether Ocean Grove was ever held by **Inalaa Pty Ltd** (a company) rather than Lloyd personally (see the Ocean Grove flag), the accountant should satisfy themselves that the rental loss belongs on Lloyd's individual return and not in a company. If the property/loss actually sat in an entity, this deduction is exposed.

---

## 2. Milani Simic — personal, year over year

| FY | Gross wages | PAYG withheld | Super | Taxable income (assessed) | Source |
|---|---:|---:|---:|---:|---|
| 2022 | $40,733 | $6,303 | $2,682 | — | `personal/milani/2022/milani_ato_2022.pdf` |
| 2023 | $77,110.27 | $17,124 | $8,096.58 | — | `personal/milani/2023/milani_income_statement_fy2023.pdf` |
| 2025 | $82,145.28 (Myer) | $17,112 | — | **$38,990** | `personal/milani/2025/milani_payg_2025.pdf`; `.../milani_fy2025_tax_assessment.pdf` |

- Milani's earnings roughly **doubled** FY2022 → FY2023 ($40.7k → $77.1k) and held around $82k by FY2025.
- **FY2025 shows the same below-gross pattern as Lloyd:** gross wages $82,145 vs assessed taxable income **$38,990** — a gap of ~$43,155 of deductions/losses, producing a **refund of $13,654.30** (tax $3,326.40 on the assessment). The source of Milani's FY2025 deductions is **not fully documented in the files reviewed** (`milani_expenses_2025.xlsx` itemises expense claims but was not reconciled line-by-line to the $43k figure) — flag for the accountant to confirm what is driving it (possibly a share of an investment/trust loss, or work-related + other deductions).
- **FY2024 is missing** for Milani (no FY2024 folder) — gap to fill from the accountant's records.

> ⚠️ **Flag:** the ~$43k gap between Milani's gross and taxable income for FY2025 is large relative to her income and is **not yet traced to a source document**. Do not assume it is correct until the accountant confirms the composition.

---

## 3. Entities — income, distributions, and losses carried forward

All entity figures below come from the **consolidated annual booklets** (`tax-history/consolidated-annual-booklets/taxation_booklet_fy20XX.pdf`), which contain the lodged returns for The Thomas Group Trust, The Oxygen Fit Group Trust, Thomic Property Group Trust, Thomas Empire Pty Ltd, and related entities each year. **These are OCR reads of scanned ATO form boxes — verify against the accountant's copies.**

### The Thomas Group Trust (Property Developer — holds the Tyquin St result)
| FY | Reported position | Source |
|---|---|---|
| 2023 | Item 20 net income **$4,162**; **net capital gain $100,969**; Item 26 total **$96,807**. Distributions out: (1) IG UNIT TRUST **$19,207.00**, (2) OXYGEN FIT GROUP TRUST **$22,000.00** | `taxation_booklet_fy2023.pdf` |
| 2025 | Business income **$529,545**; net business income ≈**$205,405**; Item 20/26 net income **$265,445**; **tax losses carried forward $544,481**; income of the trust estate to distribute **$0** (absorbed by losses) | `taxation_booklet_fy2025.pdf` |

- The **$544,481 of tax losses carried forward** is the accumulated Tyquin St development loss (see `tyquin-st-loss-summary.md`). This is the asset Lloyd wants to preserve through the wind-up.
- The FY2025 **positive** net income ($265,445) sitting alongside a **project loss** of −$1.46m is not a contradiction: the developer is running the FY2025 sale proceeds down against a much larger pool of accumulated losses, leaving $544,481 still carried forward. (See `tyquin-st-loss-summary.md` §4 — not reconciled to the cent here.)

### The Oxygen Fit Group Trust (Thomas Empire holds 100% of units; TPM Pty Ltd trustee)
| FY | Reported position | Source |
|---|---|---|
| 2022 | Losses carried forward ≈**$17,728** | `taxation_booklet_fy2022.pdf` |
| 2023 | Received distribution **$22,000** from The Thomas Group Trust (see above) | `taxation_booklet_fy2023.pdf` |

- Carries its own small loss pool; is economically owned by Thomas Empire Pty Ltd (100% units). Relevant to the wind-up chain (`entity-wind-up-summary.md`).

### Thomic Property Group Trust (Milani's structure; Thomic Property Pty Ltd trustee)
- Lodges its own return; **FY2023 was amended** (`entities/thomic-property-pty-ltd/2023/thomic_amended_return_fy2023.pdf`). Only FY2023 is present in the entity folder; FY2021/2022/2024/2025 returns for this trust were **not located** — gap.

### SMSF — LT & MS Superannuation Fund (trustee LT & MS Investments Pty Ltd)
- Set up 2021; holds **crypto** (Koinly/Swyftx tax reports FY2021–FY2024). No FY2025 SMSF annual return or audit was located (`entities/smsf/profile.md` gap). The crypto capital-gains position (`koinly_capital_gains_2021.csv`, `koinly_2024_complete_tax_report.pdf`) should be confirmed with the fund's lodged returns.

### Thomas Empire Pty Ltd (company + trustee of The Thomas Group Trust)
- Two roles: standalone company **and** trustee of The Thomas Group Trust. Also legal vendor for two **39 Powlett St** sales (Unit 1 settled 06/08/21 $473,000; Unit 2 settled 31/10/22 $445,000) where net proceeds went to Lloyd/Milani personally, not the company (`tax-history/properties/powlett-st/findings.md`). **FY2023 was amended** (`2023/thomas_empire_amended_return_fy2023.pdf`) — reason not stated in the documents.

---

## 4. Possible missed / under-claimed deductions (for the accountant to check — not advice)

These are **prompts to investigate**, flagged from patterns in the documents, not conclusions:

1. **Lloyd — car/logbook deductions.** A logbook workbook exists for FY2021-22 (`personal/lloyd/2022/lloyd_logbook_fy2122.xlsx`) but there is **no equivalent logbook for FY2023, FY2024, or FY2025** in the folders. If Lloyd continued using a vehicle for income-producing purposes, a work-related car deduction may have lapsed in later years. Worth confirming.
2. **Lloyd — Tyquin St personal-half costs.** The FY2021 workbooks label "68 Tyquin St – Personal" and split the FY2023 contribution "per investor" (÷2), implying Lloyd personally funded ~half the holding costs. If any of that personal half (e.g. interest on personally-held borrowings) was deductible and **not** claimed on his individual returns, it may be a missed deduction. See `tyquin-st-loss-summary.md` §5. (Conversely, if it *was* claimed, make sure it wasn't also claimed inside the trust — double-check for duplication.)
3. **Ocean Grove — pre-FY2025 rental years.** The property earned Airbnb income Sep 2023–Mar 2024 (FY2024, net $18,028.93 / gross $22,588.88) and long-term rent in FY2025. Confirm the **FY2024 Airbnb income and its associated interest/expenses** were reported — if the property was already negatively geared in FY2024, a rental loss may have been claimable that year too, not just FY2025.
4. **Milani FY2025 deductions unexplained** (see §2) — the flip side of a missed deduction is an **unsupported** one; make sure the ~$43k gap is properly substantiated.
5. **Capital losses.** The SMSF crypto position and any entity capital losses (e.g. Oxygen Fit's ~$17.7k) should be checked for correct carry-forward — capital losses are easy to lose track of across years and entities.

---

## 5. Data-quality flags (carry into any reliance on these figures)

- **OCR of ATO form boxes is error-prone.** Every entity figure in §3 and the assessed taxable-income figures were read from scanned returns. Treat the workbook/XLSX-sourced figures (Tyquin, Ocean Grove) as reliable, and **verify all form-box figures against the accountant's lodged copies.**
- **FY2022 booklet cover mislabel.** `taxation_booklet_fy2022.pdf` has a **cover that reads "30 JUNE 2021"** (a template carry-over) but the returns inside are the **2022** returns. Don't be thrown by the cover date.
- **Missing years:** Milani FY2024 (no folder); Thomic Property Group Trust FY2021/2022/2024/2025; SMSF FY2025 annual return/audit. These gaps should be filled from the accountant's records before drawing year-over-year conclusions for those entities.
- **Discrepancies flagged, not reconciled:** Ocean Grove rent $33,142 (`OG.xlsx`) vs $33,325 (Bellarine folio); Tyquin TH68A $545k (contract) vs $548k (adjustment); Thomas Group Trust positive FY2025 net income vs project-level loss. Each is explained in the relevant deliverable and left for the accountant to settle.

---

## 6. Source files

- Personal: `personal/lloyd/2022–2025/*`, `personal/milani/2022–2025/*`
- Entities: `consolidated-annual-booklets/taxation_booklet_fy2020–2025.pdf`; `entities/*/profile.md` and the per-year subfolders
- Property: `property-sales/ocean-grove/findings.md`, `properties/powlett-st/findings.md`, `tyquin-st-loss-summary.md`
