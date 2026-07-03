# Claims patterns — coverage index (not yet a patterns analysis)

Honest status: this is a **coverage matrix** of what's been collected, not yet the actual claims-pattern analysis Lloyd asked for (point #1 in the original brief). Building the real pattern view means opening each taxation booklet/return and extracting the actual deduction line items year over year — that's real work, not done in this pass.

## The big find: consolidated annual booklets cover almost everything already

`tax-history/consolidated-annual-booklets/` has one document per year, FY2020 through FY2025 (FY2024 is the amended version), each one prepared by J. Giuffre & Co and covering **The Thomas Group Trust, The Oxygen Fit Group Trust, Thomic Property Group Trust (from FY2023), Thomas Empire Pty Ltd, Lloyd Thomas, and Milani Simic together** in a single file. This is a much better source for the pattern analysis than piecing together individual entity documents — six years, one consistent format, one accountant.

| Year | In consolidated booklet |
|---|---|
| FY2020 | The Thomas Group Trust, The Oxygen Fit Group Trust, Lloyd, Milani |
| FY2021 | The Thomas Group Trust, The Oxygen Fit Group Trust, Thomic Property Group Trust, Lloyd, Milani |
| FY2022 | Same as FY2021 |
| FY2023 | + Thomas Empire Pty Ltd added |
| FY2024 (amended) | Same as FY2023 |
| FY2025 | Same as FY2023 |

## Supplementary documents (outside the consolidated booklets)

| | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| Lloyd (personal) | ✅ PAYG, workbook | ✅ ATO letter, log book, workbook, 2022 return | ✅ Income statement, workbook | ✅ Income statement, workbook | ✅ Assessment, PAYG, workbook |
| Milani (personal) | ✅ PAYG, workbook | ✅ ATO letter, workbook | ✅ Income statement, workbook | ✅ Expenses workbook | ✅ Assessment, PAYG, workbook |
| Thomas Empire Pty Ltd | ✅ Land tax, 2021 return, PAYG, Tyquin St workbooks | — | ✅ Amended return, Powlett St sale docs, Tyquin St amended workbook | — | ✅ Payment slip, Tyquin St workbook, Tyquin St lot sale docs (4 lots) |
| Thomas Property Management / Oxygen Fit Group | ✅ BAS, property mgmt report, unit register, deed, ASIC extract (undated) | | ✅ Book6 workbook | | ✅ Kia transfer docs (2026, resolves car blocker) |
| Thomic Property / Thomic Group Trust | ✅ ASIC extract | — | ✅ Amended return | — | — |
| SMSF (LT & MS) | ✅ Setup, Koinly (ATO report, complete tax report, capital gains/income/expenses/other gains) | ✅ ATO crypto report, NAB statement/workbook, Koinly, Swyftx | ✅ Koinly, Swyftx, NAB statement, audit letter, trustee rep letter | — | — |
| Ocean Grove (personal) | — | — | — | ✅ Airbnb rental income Sep–Dec | ✅ Airbnb rental income Jan–Mar, 2018 purchase docs |
| Powlett St (Thomas Empire, new) | ✅ Unit 1 sale + settlement (Aug 2021) | ✅ Unit 2 rental history, sale docs (Oct 2022) | ✅ Unit 1/2 workbooks, summary | — | — |
| Ashby Crt (new, not yet profiled) | — | ✅ Proof of balance, rental summary, workbook | ✅ Rental statement, ING interest | ✅ Rental statement | ✅ Rental summary |

## Next step to actually answer "what are my claim patterns"

Now that all six years of the consolidated booklets are collected, the real analysis is: open each one's schedules for each entity, extract category-level figures (income, deductions, distributions, losses) per year, and line them up side by side. That's a natural fit for the app itself once v2 (Tax pack) is built — the app can parse these booklets and hold the structured data, rather than this being a one-off manual read-through. Given the booklets are large (1.7MB–14.5MB PDFs), this extraction is a real chunk of work, not a quick pass.

## This year's maximisation (point #2)

FY2025's consolidated booklet plus the supplementary FY2025 documents (Thomas Empire, both personal returns) are the most complete data set collected. Line-item extraction from the FY2025 booklet specifically is the most direct next step for "what am I likely missing this year" — not done yet.

## Structural findings that affect the loss-preservation plan (points #4 and #5)

Both of Lloyd's "deregister the company, keep the entity/losses available" plans (Thomas Empire in point #4, Thomic in point #5) turn out to be more tangled than a single company/trust pair:

- **Thomas Empire Pty Ltd** is trustee of **The Thomas Group Trust** (newly discovered) and holds 100% of the units in **The Oxygen Fit Group Trust** (trustee: Thomas Property Management Pty Ltd). Deregistering the company affects both.
- **Thomic Property Pty Ltd** is the sole trustee of **Thomic Property Group Trust**, and Milani is its sole director — deregistering the company removes the trust's only trustee.

None of this is resolved — it's flagged in each entity's profile.md and needs the accountant's input before Lloyd proceeds with either deregistration.


## Third pass additions (2026-07-03, "tax-relevant only" scope)

- Tyquin St lot sale documents (contracts + adjustment statements, all 4 lots) added to Thomas Empire's profile — primary source for the development loss figure, not yet totalled.
- Ocean Grove: 2018 original purchase documents added (cost-base starting point) — flagged an unresolved entity mismatch (purchaser was "Inalaa Pty Ltd", not Lloyd personally or any known entity). Plus 7 months of Airbnb rental statements (Sep 2023–Mar 2024).
- Kia transfer documents added to Thomas Property Management's profile — resolves the "car still registered to the company" retirement blocker (point #3 in the original brief).
- Lloyd's FY2024 personal income statement and workbook added, closing a previously-unnoticed gap.
- Ashby Crt rental summaries (2024, 2025) collected as a new, not-yet-profiled property.
- Not pulled in this pass (descoped as not tax-relevant): raw bank statements, generic property backup documents, "Latest Docs"/"New Docs" miscellaneous subfolders.


## Fourth pass additions (2026-07-03, full `_Archive/2021-2023` sweep)

Lloyd asked directly whether all 2021–2023 documents were in the repo — they weren't. This pass crawled the full Drive `_Archive/2021-2023` folder tree (not just the consolidated booklets) and pulled everything tax-relevant: PAYG summaries and personal workbooks for both Lloyd and Milani (2021, 2022), Lloyd's individual FY2022 tax return, SMSF/crypto reporting (Koinly ATO reports, complete tax reports, capital gains/income/expenses/other gains summaries, Swyftx transaction reports, SMSF audit letter and trustee representation letter), Thomas Property Management's BAS and a property management report, Thomic's ASIC extract, Thomas Empire's 2021 tax return/PAYG/land tax, and two full property sale document sets: Tyquin St workbooks (68, 70, project costs, amended, FY24) and — the big find — **39 Powlett St**, a two-unit property sold across 2021 and 2022 that wasn't part of the original brief at all. See `properties/powlett-st/findings.md` for the flagged company-vendor/personal-proceeds mismatch on both sales.

Deliberately not pulled: raw bank statement CSVs/PDFs (Bills Account, Everyday Account, Ashby.csv, TransactionHistory, Tyquin St Account, Powlett St.csv, ING/NAB/Ashby Crt NAB raw statements), company minutes (Thomas Empire, Thomas Property Management), signing-page-only admin documents, accountant invoices, a "Lloyd Taxes.zip" (unopened), Koinly beginning/end-of-year holdings snapshots and raw transaction history CSVs (kept the ATO-ready reports and capital gains/income/expenses/other-gains summaries instead), and likely-duplicate FY2023 personal/entity documents that were already captured in earlier passes under different filenames.
