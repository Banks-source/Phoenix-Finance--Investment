-- Phoenix Finance v2 (Tax) — FY26 claim estimates
-- Stores a manual/estimated deduction figure per person, financial year and
-- normalised category. The UI seeds each cell with an estimate derived from
-- prior-year workbook data; saving a value here overrides that estimate.
-- `category` holds the normalised label from lib/claimsHistory.ts (e.g. "Car & transport").

create table if not exists claim_estimates (
  person    text    not null,          -- 'lloyd' | 'milani'
  fy        int     not null,          -- FY end year, e.g. 2026
  category  text    not null,          -- normalised claim category label
  amount    numeric not null,
  updated_at timestamptz not null default now(),
  primary key (person, fy, category)
);

alter table claim_estimates enable row level security;
