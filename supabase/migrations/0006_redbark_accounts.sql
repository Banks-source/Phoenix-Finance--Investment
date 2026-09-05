-- Phoenix Finance v1.x — Redbark bank-feed integration
-- Links internal `accounts` rows to Redbark's opaque account ids, and holds
-- the owner mapping for Redbark accounts as an explicit table rather than an
-- inferred rule (unlike NAB/CBA CSV import, Redbark can surface accounts
-- from any institution, and the API returns no account-holder name at all —
-- see lib/redbarkSync.ts for why this can't be auto-derived safely).

alter table accounts add column redbark_account_id text unique;
alter table accounts add column redbark_last_synced_at timestamptz;

create table redbark_account_owners (
  redbark_account_id text primary key,
  owner owner_t not null,
  note text,                      -- e.g. "NAB Everyday, confirmed by Lloyd 2026-09"
  created_at timestamptz not null default now()
);

alter table redbark_account_owners enable row level security;
