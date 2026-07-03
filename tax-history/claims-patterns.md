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
| Lloyd (personal) | — | — | ✅ Income statement, workbook | — | ✅ Assessment, PAYG, workbook |
| Milani (personal) | — | — | ✅ Income statement, workbook | ✅ Expenses workbook | ✅ Assessment, PAYG, workbook |
| Thomas Empire Pty Ltd | Financial summary | — | ✅ Amended return | — | ✅ Payment slip, Tyquin St workbook |
| Thomas Property Management / Oxygen Fit Group | Unit register, deed, ASIC extract (undated) | | | | |
| Thomic Property / Thomic Group Trust | Trust deed (undated) | — | ✅ Amended return | — | — |
| SMSF (LT & MS) | Setup | — | ✅ Koinly report, NAB summary | — | — |

## Next step to actually answer "what are my claim patterns"

Now that all six years of the consolidated booklets are collected, the real analysis is: open each one's schedules for each entity, extract category-level figures (income, deductions, distributions, losses) per year, and line them up side by side. That's a natural fit for the app itself once v2 (Tax pack) is built — the app can parse these booklets and hold the structured data, rather than this being a one-off manual read-through. Given the booklets are large (1.7MB–14.5MB PDFs), this extraction is a real chunk of work, not a quick pass.

## This year's maximisation (point #2)

FY2025's consolidated booklet plus the supplementary FY2025 documents (Thomas Empire, both personal returns) are the most complete data set collected. Line-item extraction from the FY2025 booklet specifically is the most direct next step for "what am I likely missing this year" — not done yet.

## Structural findings that affect the loss-preservation plan (points #4 and #5)

Both of Lloyd's "deregister the company, keep the entity/losses available" plans (Thomas Empire in point #4, Thomic in point #5) turn out to be more tangled than a single company/trust pair:

- **Thomas Empire Pty Ltd** is trustee of **The Thomas Group Trust** (newly discovered) and holds 100% of the units in **The Oxygen Fit Group Trust** (trustee: Thomas Property Management Pty Ltd). Deregistering the company affects both.
- **Thomic Property Pty Ltd** is the sole trustee of **Thomic Property Group Trust**, and Milani is its sole director — deregistering the company removes the trust's only trustee.

None of this is resolved — it's flagged in each entity's profile.md and needs the accountant's input before Lloyd proceeds with either deregistration.
