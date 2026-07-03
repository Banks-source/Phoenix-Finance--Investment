# Tax history

Reference material for the v2 Tax pack phase (see `PRD.md` §8). Built across three passes on 2026-07-03: (1) FY2023/FY2025 personal + entity documents, (2) six years of consolidated annual booklets (FY2020–FY2025) plus structural documents (trust deeds, unit registers), (3) tax-relevant-only deep dive — Tyquin St lot sale documents, Ocean Grove purchase/cost-base docs and Airbnb rental history, Kia transfer (resolves the Thomas Property Management car blocker), and Lloyd's FY2024 gap-fill. FY2021, FY2022 still have gaps — see `claims-patterns.md` for the coverage matrix.

## Entities

| Entity | Status | Profile |
|---|---|---|
| Thomas Empire Pty Ltd | Active, unpaid fees — Lloyd hoping for ASIC deregistration | [`entities/thomas-empire-pty-ltd/profile.md`](./entities/thomas-empire-pty-ltd/profile.md) |
| The Thomas Group Trust | Newly discovered 2026-07-03, trustee is Thomas Empire Pty Ltd | [`entities/thomas-group-trust/profile.md`](./entities/thomas-group-trust/profile.md) |
| Thomas Property Management Pty Ltd (& Oxygen Fit Group) | To be retired — car still registered to it | [`entities/thomas-property-management-oxygen-fit/profile.md`](./entities/thomas-property-management-oxygen-fit/profile.md) |
| Thomic Property Pty Ltd (trustee of Thomic Property Group Trust) | To be deregistered, trust structure to be retained | [`entities/thomic-property-pty-ltd/profile.md`](./entities/thomic-property-pty-ltd/profile.md) |
| LT & MS Investments Pty Ltd / LT & MS Superannuation Fund (SMSF) | Active | [`entities/smsf/profile.md`](./entities/smsf/profile.md) |

## Consolidated annual booklets

`consolidated-annual-booklets/` — one document per year, FY2020 through FY2025, prepared by J. Giuffre & Co, each covering every entity and both personal returns together. This is the single best source for the claims-pattern analysis (point #1 of the original brief) — see `claims-patterns.md`.

## Personal

- `personal/lloyd/` — FY2025 tax assessment, PAYG summary, personal expense workbook.
- `personal/milani/` — FY2025 tax assessment, PAYG summary, personal expense workbook.

## Properties

- `properties/ashby-crt/` — rental financial summaries (2024, 2025) for the Ashby Crt investment property. Not yet profiled in depth — newly surfaced in the third pass.

## Property sales

- `property-sales/ocean-grove/` — the forced mortgagee sale of Unit 1, 91 The Avenue, Ocean Grove, plus the original 2018 purchase documents and 7 months of Airbnb rental statements (Sep 2023–Mar 2024). See `findings.md` in that folder for the full picture (purchase, sale price, shortfall, capital loss inputs) — including a flagged discrepancy: the 2018 purchase was made by an entity called **Inalaa Pty Ltd**, not by Lloyd personally or any of the five entities in the original brief. Not yet resolved.

## Key structural finding

Thomas Empire Pty Ltd holds 100% of the units in The Oxygen Fit Group Trust (trustee: Thomas Property Management Pty Ltd). Lloyd's deregistration plans for both entities are not independent of each other — see both profiles.

## Gaps (not done yet)

- FY2021, FY2022 still missing across most entities/personal — see `claims-patterns.md` for the exact coverage matrix.
- No actual claims-pattern analysis yet (that requires opening each booklet's deduction schedule line by line) — `claims-patterns.md` is currently just a coverage index, not the analysis itself.
- No structured/machine-readable extraction yet — everything here is source PDFs/spreadsheets, not yet parsed into the app's data model. That's tomorrow's app-development work, not a Drive-retrieval task.
- Inalaa Pty Ltd (Ocean Grove's original 2018 purchaser) is an unresolved entity — see `property-sales/ocean-grove/findings.md`.
- Ashby Crt not yet profiled as a full property entry (ownership entity, purchase history, etc.) — only rental summaries collected so far.
