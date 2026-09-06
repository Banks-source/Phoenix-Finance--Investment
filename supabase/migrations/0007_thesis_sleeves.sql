-- Phoenix Finance v3 — thesis sleeve mapping (#4)
-- Two small reference tables, same pattern as merchant_rules /
-- redbark_account_owners: automatic rules handle the obvious majority
-- (crypto, cash), everything else needs an explicit decision rather than a
-- guess — see lib/sleeves.ts.

-- Which group (personal vs retirement/super) each Kubera portfolio belongs
-- to. A portfolio with no row here is treated as unmapped, not silently
-- assumed personal or retirement.
create table portfolio_groups (
  kubera_portfolio_id text primary key,
  portfolio_name text not null,
  group_name text not null check (group_name in ('personal', 'retirement')),
  note text,
  created_at timestamptz not null default now()
);
alter table portfolio_groups enable row level security;

-- Manual sleeve override for a specific holding, keyed by the Kubera asset's
-- own id (stable across nightly snapshots) plus its portfolio. Covers
-- anything the automatic rules in lib/sleeves.ts can't confidently classify
-- (biofuels, individual stocks, super with no holding-level detail, etc.) —
-- populated deliberately, never inferred.
create table sleeve_overrides (
  kubera_portfolio_id text not null,
  asset_id text not null,
  asset_name text not null,        -- for readability when reviewing this table directly
  sleeve text not null,            -- one of the 6 sleeve codes, 'property', or 'legacy'
  note text,
  created_at timestamptz not null default now(),
  primary key (kubera_portfolio_id, asset_id)
);
alter table sleeve_overrides enable row level security;
