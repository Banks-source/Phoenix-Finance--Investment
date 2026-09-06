-- Phoenix Finance v3 — thesis sleeve target bands (#5)
-- Empty by default, same pattern as `budgets` (BACKLOG.md: "Budget tab will
-- show 'no targets set' for every category until you add rows") — the
-- allocation dashboard lets you set these directly rather than blocking on
-- them existing up front.

create table sleeve_targets (
  sleeve text primary key,
  min_pct numeric(5,2) not null,
  max_pct numeric(5,2) not null,
  updated_at timestamptz not null default now()
);
alter table sleeve_targets enable row level security;
