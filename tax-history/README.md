# Tax history

Reference material for the v2 Tax pack phase (see `PRD.md` §8). Second pass captured 2026-07-03 — FY2023 and FY2025 across personal and entities, plus structural documents (trust deeds, unit registers) for all four entities. FY2021, FY2022, FY2024 still have gaps — see `claims-patterns.md` for the coverage matrix.

## Entities

| Entity | Status | Profile |
|---|---|---|
| Thomas Empire Pty Ltd | Active, unpaid fees — Lloyd hoping for ASIC deregistration | [`entities/thomas-empire-pty-ltd/profile.md`](./entities/thomas-empire-pty-ltd/profile.md) |
| Thomas Property Management Pty Ltd (& Oxygen Fit Group) | To be retired — car still registered to it | [`entities/thomas-property-management-oxygen-fit/profile.md`](./entities/thomas-property-management-oxygen-fit/profile.md) |
| Thomic Property Pty Ltd (trustee of Thomic Property Group Trust) | To be deregistered, trust structure to be retained | [`entities/thomic-property-pty-ltd/profile.md`](./entities/thomic-property-pty-ltd/profile.md) |
| LT & MS Investments Pty Ltd / LT & MS Superannuation Fund (SMSF) | Active | [`entities/smsf/profile.md`](./entities/smsf/profile.md) |

## Personal

- `personal/lloyd/` — FY2025 tax assessment, PAYG summary, personal expense workbook.
- `personal/milani/` — FY2025 tax assessment, PAYG summary, personal expense workbook.

## Property sales

- `property-sales/ocean-grove/` — the forced mortgagee sale of Unit 1, 91 The Avenue, Ocean Grove. See the profile note in that folder for the full picture (sale price, shortfall, capital loss inputs).

## Key structural finding

Thomas Empire Pty Ltd holds 100% of the units in The Oxygen Fit Group Trust (trustee: Thomas Property Management Pty Ltd). Lloyd's deregistration plans for both entities are not independent of each other — see both profiles.

## Gaps (not done yet)

- FY2021, FY2022, FY2024 still missing across most entities/personal — see `claims-patterns.md` for the exact coverage matrix.
- No actual claims-pattern analysis yet (that requires opening each booklet's deduction schedule line by line) — `claims-patterns.md` is currently just a coverage index, not the analysis itself.
- No structured/machine-readable extraction yet — everything here is source PDFs/spreadsheets, not yet parsed into the app's data model. That's tomorrow's app-development work, not a Drive-retrieval task.
