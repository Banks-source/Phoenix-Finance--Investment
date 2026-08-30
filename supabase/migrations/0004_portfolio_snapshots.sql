-- Phoenix Finance v3 — Kubera portfolio snapshots (#3)
-- Append-only time-series of net worth/holdings pulled from the Kubera API.
-- Kept append-only (never updated in place) so Phoenix retains full history
-- even if Kubera is later cancelled — see SOLUTION_DESIGN.md §9.1.

create table portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz not null default now(),
  kubera_portfolio_id text not null,
  portfolio_name text,
  currency text not null,
  total_assets numeric(14,2) not null,
  total_debts numeric(14,2) not null,
  net_worth numeric(14,2) not null,
  assets jsonb not null default '[]',       -- raw asset line items from Kubera (id, name, ticker, value, type...)
  debts jsonb not null default '[]',        -- raw debt line items from Kubera
  raw_response jsonb not null,              -- full portfolio-detail response, for forward-compat/debugging
  created_at timestamptz not null default now()
);
create index idx_portfolio_snapshots_synced_at on portfolio_snapshots(synced_at);
create index idx_portfolio_snapshots_portfolio_id on portfolio_snapshots(kubera_portfolio_id);

-- Same default-deny pattern as every other table: service role (server-only)
-- bypasses RLS, no anon/authenticated policies exist.
alter table portfolio_snapshots enable row level security;
