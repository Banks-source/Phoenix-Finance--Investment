# Tax history

Reference material for the v2 Tax pack phase (see `PRD.md` §8). First pass captured 2026-07-03 — FY2025 only, across personal and all known entities. FY2021–FY2024 and a deeper pass on Thomas Property Management & Oxygen Fit Group are still outstanding (see Gaps below).

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

## Gaps (not done in this pass)

- FY2021–FY2024 for all entities and both personal returns — only FY2025 pulled so far.
- Thomas Property Management & Oxygen Fit Group: only the top-level company registration and trust deed docs pulled. The "Latest Docs" and "New Docs - 14_2_2021" subfolders in Drive haven't been opened yet.
- `claims-patterns.md` (synthesized view of what's been claimed where, for pattern-spotting) — needs multiple years of data before it's useful, so deferred until the historical pull is done.
- No structured/machine-readable extraction yet — everything here is source PDFs/spreadsheets, not yet parsed into the app's data model. That's app-development work, not a Drive-retrieval task.
