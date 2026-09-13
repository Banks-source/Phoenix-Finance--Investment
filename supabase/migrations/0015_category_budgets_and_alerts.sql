-- Per-category monthly budget targets, editable from /budget. Defaults are
-- computed on the fly (year-to-date monthly average) — a row here only
-- exists once the user has set or overridden that default.
create table category_budgets (
  category text primary key references categories(name),
  monthly_target numeric(12,2) not null,
  updated_at timestamptz not null default now()
);
alter table category_budgets enable row level security;

-- Budget alert rules: which category, what channel, where to send it, and
-- the % of the monthly budget that triggers it. Configured from
-- /settings/alerts. Delivery itself needs an email/SMS provider configured
-- server-side (see lib/alerts/notify.ts) — this table just holds the rules.
create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null references categories(name),
  channel text not null check (channel in ('email', 'sms')),
  destination text not null, -- email address or phone number (E.164)
  threshold_pct int not null default 100 check (threshold_pct > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table alert_rules enable row level security;

-- Tracks which (category, year-month, threshold) combinations have already
-- fired, so a check that runs more than once a day doesn't re-alert.
create table alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_rule_id uuid not null references alert_rules(id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  triggered_at timestamptz not null default now(),
  unique (alert_rule_id, period)
);
alter table alert_events enable row level security;
