-- Phoenix Finance v3 — editable thesis page
-- Promotes the hard-rule thresholds (previously hardcoded constants in
-- lib/hardRules.ts) into an editable table, same "no targets set until you
-- add them" pattern as budgets/sleeve_targets — seeded with the current
-- hardcoded values so behaviour is unchanged until Lloyd edits them.
-- Also adds a free-text thesis-notes singleton and makes kill-criteria
-- templates fully CRUD-able (they already existed from migration 0010).

create table hard_rule_params (
  param_key text primary key,
  value numeric not null,
  label text not null,
  updated_at timestamptz not null default now()
);
alter table hard_rule_params enable row level security;

insert into hard_rule_params (param_key, value, label) values
  ('btc_pct_of_nw_max', 40, 'BTC max % of total net worth (rule 2)'),
  ('single_asset_pct_max', 15, 'Other single-asset max % of investable net worth (rule 2)'),
  ('lvr_pct_max', 30, 'Max LVR on an income property (rule 3)'),
  ('liquidity_months', 3, 'Months of expenses the liquidity floor covers (rule 4)')
on conflict (param_key) do nothing;

-- Singleton free-text thesis narrative — id is always 'main'.
create table thesis_notes (
  id text primary key default 'main',
  notes text,
  updated_at timestamptz not null default now()
);
alter table thesis_notes enable row level security;
insert into thesis_notes (id, notes) values ('main', null) on conflict (id) do nothing;
