-- Phoenix Finance v3 — legacy holdings that breach the thesis (#8)
-- Distinct from sleeve classification: a legacy position may still have a
-- sleeve for reporting purposes. It's flagged here because it predates or
-- breaches the thesis, not because it's unclassified. Every row requires a
-- reason and a review date — no silent flag-and-forget.

create table legacy_positions (
  kubera_portfolio_id text not null,
  asset_id text not null,
  asset_name text not null,
  reason text not null,
  breached_rule int,              -- which hard rule # this breaches (see lib/hardRules.ts), if any
  review_date date not null,
  decision text check (decision in ('exit', 'hold', 'reclassify')), -- null = not yet decided
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kubera_portfolio_id, asset_id)
);
alter table legacy_positions enable row level security;
