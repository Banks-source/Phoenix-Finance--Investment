# Tax history

Reference material for the v2 Tax pack phase (see `PRD.md` §8). Built across four passes on 2026-07-03: (1) FY2023/FY2025 personal + entity documents, (2) six years of consolidated annual booklets (FY2020–FY2025) plus structural documents (trust deeds, unit registers), (3) tax-relevant-only deep dive on FY2024/2025 — Tyquin St lot sale documents, Ocean Grove purchase/cost-base docs and Airbnb rental history, Kia transfer (resolves the Thomas Property Management car blocker), Lloyd's FY2024 gap-fill, (4) full sweep of the `_Archive/2021-2023` folder — PAYG/personal workbooks, SMSF/crypto (Koinly, Swyftx) reports, land tax, and a newly-discovered property (39 Powlett St, two units sold 2021 and 2022) with its own flagged company/personal proceeds mismatch. Raw bank CSVs and admin paperwork (minutes, invoices, signing pages) were intentionally skipped throughout — see `claims-patterns.md` for exactly what's covered.

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

- `properties/ashby-crt/` — rental financial summaries and history (2022–2025) for the Ashby Crt investment property. Not yet profiled in depth (no dedicated profile.md — ownership entity, purchase history not established).
- `properties/powlett-st/` — **new discovery, not in the original brief.** Two units at 39 Powlett St, Altona Meadows, both sold (Unit 1 in 2021, Unit 2 in 2022) with Thomas Empire Pty Ltd as legal vendor but sale proceeds paid to Lloyd/Milani personally. See `findings.md` in that folder — this is a real CGT event that needs your accountant's input on where the gain/loss actually sits.

## Property sales

- `property-sales/ocean-grove/` — the forced mortgagee sale of Unit 1, 91 The Avenue, Ocean Grove, plus the original 2018 purchase documents and 7 months of Airbnb rental statements (Sep 2023–Mar 2024). See `findings.md` in that folder for the full picture (purchase, sale price, shortfall, capital loss inputs) — including a flagged discrepancy: the 2018 purchase was made by an entity called **Inalaa Pty Ltd**, not by Lloyd personally or any of the five entities in the original brief. Not yet resolved.

## Key structural finding

Thomas Empire Pty Ltd holds 100% of the units in The Oxygen Fit Group Trust (trustee: Thomas Property Management Pty Ltd). Lloyd's deregistration plans for both entities are not independent of each other — see both profiles.

## Gaps (not done yet)

- No actual claims-pattern analysis yet (that requires opening each booklet's deduction schedule line by line) — `claims-patterns.md` is currently just a coverage index, not the analysis itself.
- No structured/machine-readable extraction yet — everything here is source PDFs/spreadsheets, not yet parsed into the app's data model. That's tomorrow's app-development work, not a Drive-retrieval task.
- Inalaa Pty Ltd (Ocean Grove's original 2018 purchaser) is an unresolved entity — see `property-sales/ocean-grove/findings.md`.
- Thomas Empire Pty Ltd's role as vendor-but-not-recipient on both Powlett St sales is unresolved — see `properties/powlett-st/findings.md`.
- Ashby Crt not yet profiled as a full property entry (ownership entity, purchase history, etc.) — rental summaries/statements 2022–2025 collected, but no findings.md written yet.
- Intentionally not pulled (raw/admin, deemed not tax-relevant): bank statement CSVs and PDFs, company minutes, signing-page paperwork, accountant invoices, Koinly/Swyftx raw transaction histories and portfolio snapshot reports (only the ATO-ready reports and capital gains/income/expense summaries were pulled).
