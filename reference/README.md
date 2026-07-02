# Reference materials

Not application code — kept for provenance and audit trail, so any transformation in `supabase/seed/` can be re-verified against the original source.

## source-workbooks/

The four Google Drive Budget workbooks the historical backfill (`supabase/seed/transactions_backfill.csv`, `backfill_*_of_4.sql`) was built from. See `PRD.md` §6 for which sheet in each file was used and why the sheet names don't match the years they actually contain.

Verified 2026-07-02: summing `transactions_backfill.csv` by category for Jan–Mar 2026 (excluding Income and Money Movement, which the source pivot doesn't count as expenses either) matches the "Expenses Sum of Amount" pivot in `2026-budget-v1.2.xlsx` exactly, to the cent, across all 20 categories and the grand total (-$73,353.45).
