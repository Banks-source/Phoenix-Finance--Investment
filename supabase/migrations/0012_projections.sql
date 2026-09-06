-- Phoenix Finance v3 — forward-looking portfolio projections
-- Singleton settings row (current age, monthly contributions, "other
-- assets" growth rate) + one editable growth-rate row per thesis sleeve.
-- Everything defaults to 0 / null until Lloyd sets real numbers — same "no
-- targets set" pattern as budgets/sleeve_targets.

create table projection_settings (
  id text primary key default 'main',
  current_age int,
  personal_monthly_contribution numeric not null default 0,
  retirement_monthly_contribution numeric not null default 0,
  other_assets_growth_pct numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table projection_settings enable row level security;
insert into projection_settings (id) values ('main') on conflict (id) do nothing;

create table sleeve_growth_rates (
  sleeve text primary key,
  annual_growth_pct numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table sleeve_growth_rates enable row level security;
