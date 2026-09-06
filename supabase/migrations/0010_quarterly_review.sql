-- Phoenix Finance v3 — quarterly review workflow (#6)
-- kill_criteria_templates is the editable master list (seeded with EXAMPLE
-- placeholder criteria — see scripts/seed_quarterly_review.ts — Lloyd
-- replaces these with his real thesis's 8 kill criteria). Each
-- quarterly_reviews row snapshots the template text into kill_criteria at
-- the time of that review, so editing the template later never rewrites
-- history (same principle as hard-rule versioning).

create table kill_criteria_templates (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null,
  text text not null,
  is_example boolean not null default true, -- flips to false once Lloyd replaces it with real text
  created_at timestamptz not null default now()
);
alter table kill_criteria_templates enable row level security;

create table quarterly_reviews (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  elapsed_seconds int,
  cycle_inputs_notes text,       -- step 3, free text (see lib/quarterlyReview.ts for example prompts)
  kill_criteria jsonb not null default '[]', -- step 4, snapshot: [{text, status: 'yes'|'no'|'not_assessed', note}]
  actions_notes text,            -- step 5
  markdown_log text,             -- step 6, generated on completion
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table quarterly_reviews enable row level security;
