-- Live balances per linked account, refreshed by the Redbark sync, plus a
-- daily snapshot so balance-over-time history accumulates for free.
alter table accounts add column if not exists balance_current numeric(14,2);
alter table accounts add column if not exists balance_available numeric(14,2);
alter table accounts add column if not exists balance_observed_at timestamptz;

create table if not exists balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  observed_on date not null,
  current numeric(14,2) not null,
  available numeric(14,2),
  created_at timestamptz not null default now(),
  unique (account_id, observed_on)
);

alter table balance_snapshots enable row level security;
