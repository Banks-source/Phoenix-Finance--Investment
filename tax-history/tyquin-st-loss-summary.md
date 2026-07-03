# Tyquin Street development — loss summary

**Prepared:** 2026-07-04 · **For:** the accountant (J. Giuffre & Co) and Lloyd/Milani's own reference
**This is reference material assembled from the source files — not tax or legal advice.**

**Property:** Tyquin Street, Laverton VIC 3028 — a multi-lot townhouse development (originally planned as 6 townhouses across 68 & 70 Tyquin St; 4 lots ultimately sold).
**Developer entity (per FY2025 tax return):** The Thomas Group Trust (Property Developer, ATO industry code 32110), with **Thomas Empire Pty Ltd as trustee** — see "Where the loss sits" below.

---

## 1. The bottom line

Per the most complete and most recent cost/sales workbook, `entities/thomas-empire-pty-ltd/2025/tyquin_st_fy25_taxes.xlsx` (sheet **"Dashboard"**):

| Measure | Amount | Source cell |
|---|---:|---|
| Total Development Costs (TDC), ex-GST | **−$4,530,533.36** | Dashboard J4 |
| Total project costs incl. GST | −$4,796,244.80 | Dashboard D12 |
| Sales — 4 lots actually settled (net of GST, fees, agent) | **$2,047,351.92** | Dashboard S10 / I5 |
| Sales — incl. 2 unsold lots at estimate ($510,000 × 2) | $3,067,351.92 | Dashboard J8 |
| **Total project LOSS** | **−$1,463,181.44** | Dashboard J9 |

> ⚠️ **Read this figure carefully.** The −$1,463,181.44 is the **whole-of-project economic loss** as modelled in the workbook, and it **includes two lots that had not yet sold** (TH70B and TH68, each carried at an estimated $510,000). The **realised** loss to date rests on the **4 lots that actually settled**; the remaining ~$1.02m of "sales" is an estimate, so the final realised loss will move when those last lots settle (or are revalued). Treat −$1.46m as the project's modelled total loss, not a settled tax figure.

---

## 2. The four lots that were sold

All four are **off-the-plan** contracts, vendor's estate agent **Beyond Property Enterprises Pty Ltd**. Sale prices confirmed from both the contracts and the FY2025 workbook:

| Lot | Contract price | Net proceeds (after GST/fees/agent) | Settlement / adjustment date | Confirming source |
|---|---:|---:|---|---|
| TH70 | $590,000 | $525,284.49 | 1 Jul 2024 | `th3_70_adjustment_statement.pdf` (deposit $29,500 + balance $560,500 = $590,000; due to vendor $560,381.10); `th3_70_contract.pdf` p5 |
| TH70A | $570,000 | $510,686.23 | 2 Dec 2024 | `th2_70a_adjustment_statement.pdf` (deposit $28,500 + balance $541,500 = $570,000; due to vendor $542,749.59); `th2_70a_contract.pdf` p5 |
| TH68A | $548,000 | $484,775.34 | 11 Apr 2025 | `th5_68a_adjustment_statement.pdf` (Contract $548,000; due to vendor $521,162.48) |
| TH68B | $590,000 | $526,605.86 | 9 Sep 2024 | `th4_68b_adjustment_statement.pdf` (deposit $29,500 + balance $560,500 = $590,000; due to vendor $561,907.33); `th4_68b_contract.pdf` p5 |
| **Total** | **$2,298,000** | **$2,047,351.92** | | |

Each of the four sold lots has its own **adjustment statement** in `tyquin-st-sale-documents/`, and all four confirm the contract price via *deposit + balance of purchase price*. The lots settled progressively across FY2024–FY2025 (Jul 2024 → Apr 2025), which is why the sale proceeds land in the FY2025 developer return.

> ⚠️ **Small discrepancy on TH68A:** the **contract** (`th5_68a_contract.pdf` p5) shows a price of **$545,000**, whereas the **adjustment statement** and the FY2025 workbook both show **$548,000**. This could be a price variation between contract and settlement, or an OCR misread of the scanned contract. The **adjustment statement ($548,000, settled 11 Apr 2025) should be treated as authoritative** for the settled figure. Flagging rather than silently reconciling.

**Two lots remained unsold** at the time of the FY2025 workbook: **TH70B** (estimated $570,000 in the price column, carried at $510,000 net in the P&L) and **TH68** (marked "TBA"). Any realised loss will finalise when these settle.

**TH68A settlement mechanics** (`th5_68a_adjustment_statement.pdf` — the last lot to settle): Contract $548,000 − deposit $27,400 = $520,600; +adjustments $562.48 = **$521,162.48 balance due to vendor at settlement**; after council/water/land-tax/PEXA/solicitor cheques, ~$512,576.41 remained before loan and caveat payout. Settlement date 11 April 2025 — the final lot to complete.

---

## 3. How the costs built up (year by year)

The cost side is documented across four workbooks in `entities/thomas-empire-pty-ltd/`. Because they were prepared at different stages, they are best read as **snapshots that grow over time**, not as separate additive years.

**FY2021 snapshot** — `2021/tyquin_st_project_costs_2021.xlsx` (sheet "Sheet1"):
- Holding & operating costs (rates, water, insurance, interest, property mgmt, land tax, net of rent): grand total **−$60,626.37**
- Development costs (VCAT, town planning/permits, building permit, legal, subdivision, project management, initial build, evaluation): **−$171,765.35**

**FY2023 amended snapshot** — `2023/tyquin_st_project_amended_2023.xlsx` (sheet "Summary"):

| Phase | Amount |
|---|---:|
| Acquisition of 68 (deposit $30,000 + settlement $15,656) | −$45,656 |
| Acquisition of 70 (deposit $37,250 + settlement $26,962) | −$64,212 |
| 2016–2021 hold phase | −$68,651.31 |
| Town planning, permits & pre-build | −$196,051.37 |
| Settlement prior to construction | −$273,083.99 |
| FY21/22 | −$55,467.20 |
| **Total contribution** | **−$703,121.87** |
| **Per investor (÷2)** | **−$351,560.94** |

The **build contract itself** was $557,381.65 + variations (≈$583,000) per the same workbook. The "Per investor" halving is significant — see the ownership flag in §5.

**FY2024 snapshot** — `2023/tyquin_st_project_fy24.xlsx` (sheet "Dash - Profitability", "Full History 2012 to June 2023"):
- Costs to June 2023: **−$2,626,450.27** incl. GST (−$2,512,850.96 ex-GST)
- Feasibility to complete: total development cost −$4,117,969.96; projected sale $3,600,000; **projected profit/loss −$769,969.96** (a *feasibility projection* assuming completion and full sale — not the actual outcome)

**FY2025 snapshot (most complete)** — costs by category, `tyquin_st_fy25_taxes.xlsx` Dashboard:

| Category | Amount (incl GST) |
|---|---:|
| 1 Site acquisition | −$715,118 |
| 2 Planning | −$62,569.52 |
| 3 Build | −$2,660,837.50 |
| 4 Finance | −$1,118,510.15 |
| 5 Legals | −$121,809.17 |
| 7 Subdivision | −$27,903.60 |
| Sales costs | −$89,496.86 |
| **Grand total** | **−$4,796,244.80** |

The jump from ~$2.6m (to June 2023) to ~$4.8m reflects the completion of construction (Build grew to −$2.66m) and finance costs (−$1.12m) — consistent with the project running well over its original feasibility, and with the **iBhomes builder dispute** referenced in the workbooks (there are dedicated "iBhomes", "Clancy", "Trilogy" and "Legal" tabs in the FY24/FY25 workbooks documenting the construction/legal fight).

---

## 4. Where the loss sits (company vs trust) — the key question

**Answer, on the documents: the development income and the carried-forward losses sit in THE THOMAS GROUP TRUST, with Thomas Empire Pty Ltd acting only as its trustee — not in Thomas Empire Pty Ltd as a standalone trading company.**

Evidence, from `consolidated-annual-booklets/taxation_booklet_fy2025.pdf` (Trust Tax Return 2025, THE THOMAS GROUP TRUST):
- Page 2 of the return names the trustee: *"If the trustee is a company, THOMAS EMPIRE PTY LTD."*
- Page 3: main business activity **"Property Developer"**, industry code **32110**.
- Page 3: **Other business income $529,545 / Total business income $529,545**; total interest expense $3,957; all other expenses $779,919; **net income from business ≈ $205,405**.
- Page 4: **Item 20 Net Australian income $265,445**; Item 26 Total net income $265,445.
- Page 5: **Tax losses carried forward to later income years = $544,481** (and net capital losses carried forward label also populated). This is the accumulated development loss still available to the **trust**.
- Page 7: business address **29 Lang St, Coolum Beach QLD** (Lloyd's address) — the trust is administered from there.

> ⚠️ **OCR caveat:** the trust-return figures above (business income, net income, and the $544,481 losses carried forward) were read by OCR from the scanned ATO form boxes in `taxation_booklet_fy2025.pdf`. They are internally consistent but should be **verified against the accountant's own copy of the lodged return** before being relied on — form-box digits are the most error-prone thing in these scans.\n\nSo as at 30 June 2025 the **Thomas Group Trust carries ≈ $544,481 of tax losses forward**. The FY2025 sale of the four lots produced $529,545 of business income / $265,445 net, which the trust could absorb against its accumulated losses (Income of the trust estate at Item 57 shows $0 — i.e. after losses, nothing was left to distribute in FY2025).

**Why this matters for the wind-up plan:** the losses belong to **the trust**, and **Thomas Empire Pty Ltd is the trust's trustee**. Deregistering Thomas Empire Pty Ltd does not by itself extinguish the trust's carried-forward losses — but it removes the trust's only trustee, which the trust needs in order to continue and to ever actually use those losses. This is a structural dependency, covered in `entity-wind-up-summary.md`. **Whether the losses can in fact be carried forward and used (trust loss rules, continuity/pattern-of-distributions tests) is a question for the accountant — not addressed here.**

---

## 5. Open items and flags (do not treat as resolved)

1. **Ownership split — "68 = Personal, 70 = Thomas Empire".** The FY2021 per-lot workbooks are titled `tyquin_st_68_2021.xlsx` → *"68 Tyquin St – Personal"* and `tyquin_st_70_2021.xlsx` → *"70 Tyquin St – Thomas Empire"*, and the FY2023 workbook splits the total contribution "per investor" (÷2). That points to a **50/50 economic split between Lloyd personally and Thomas Empire / the Thomas Group Trust** at the holding stage. Yet the **FY2025 tax return puts the whole property-developer result inside the Thomas Group Trust.** These two views need reconciling by the accountant — how the personal-half vs trust-half was actually reported, and whether any of Lloyd's personal Tyquin costs were claimed in his individual returns. **Not reconciled here.**
2. **Reason for the FY2023 amendment.** There is both an original and an **amended** FY2023 position (`2023/thomas_empire_amended_return_fy2023.pdf`, `tyquin_st_project_amended_2023.xlsx`). The documents don't state *why* it was amended — likely to restate Tyquin costs/timing, but that is not confirmed in the files.
3. **The −$1.46m includes 2 unsold lots at estimate** (§1). The realised loss will change as TH70B/TH68 settle.
4. **TH68A price** $545,000 (contract) vs $548,000 (adjustment/workbook) — §2.
5. **Two lots' contracts are very large** (`th3_70_contract.pdf` is 159pp) — only the particulars/price pages were read; the vendor-name box on the particulars page did not OCR reliably (hand-completed). Vendor identity on the sale side was taken from the estate-agent line (Beyond Property Enterprises) and the group profile, not a clean typed vendor field.

---

## 6. Source files

- `entities/thomas-empire-pty-ltd/2021/tyquin_st_project_costs_2021.xlsx`, `tyquin_st_68_2021.xlsx`, `tyquin_st_70_2021.xlsx`
- `entities/thomas-empire-pty-ltd/2023/tyquin_st_project_amended_2023.xlsx`, `tyquin_st_project_fy24.xlsx`, `thomas_empire_amended_return_fy2023.pdf`
- `entities/thomas-empire-pty-ltd/2025/tyquin_st_fy25_taxes.xlsx`
- `entities/thomas-empire-pty-ltd/tyquin-st-sale-documents/th2_70a_contract.pdf`, `th3_70_contract.pdf`, `th4_68b_contract.pdf`, `th5_68a_contract.pdf`, `th5_68a_adjustment_statement.pdf`
- `consolidated-annual-booklets/taxation_booklet_fy2025.pdf` (THE THOMAS GROUP TRUST — Trust Tax Return 2025)
