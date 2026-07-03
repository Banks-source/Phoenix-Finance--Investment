-- Phoenix Finance v2 (Tax) — Phase 1: FY26 personal claims builder
-- Adds a per-transaction tax layer (kept separate from the v1 budget `status`)
-- and a reference list of ATO claim buckets. See SOLUTION_DESIGN_TAX.md §3–§4.

-- 1. Per-transaction tax layer.
--    `deductible` is tri-state: null = not yet reviewed for tax, true/false = decided.
--    `tax_category` stores a tax_categories.code. `entity_id` is added now (no FK
--    until migration 0003 creates the `entities` table) to avoid a second alter.
alter table transactions
  add column if not exists deductible   boolean,
  add column if not exists tax_category text,
  add column if not exists tax_note     text,
  add column if not exists entity_id    uuid;

create index if not exists idx_transactions_deductible on transactions(deductible);
create index if not exists idx_transactions_tax_category on transactions(tax_category);

-- 2. ATO claim buckets (reference data).
create table if not exists tax_categories (
  code         text primary key,
  label        text not null,
  schedule     text not null,          -- 'individual' | 'rental' | 'business' | 'not_deductible'
  deductible   boolean not null,
  sort         int not null default 100
);

alter table tax_categories enable row level security;

insert into tax_categories (code, label, schedule, deductible, sort) values
  -- Individual (work-related & other personal deductions)
  ('d1_car',              'Work-related car',                'individual', true, 10),
  ('d2_travel',           'Work-related travel',             'individual', true, 20),
  ('d3_clothing',         'Work-related clothing & laundry', 'individual', true, 30),
  ('d4_self_education',    'Self-education',                  'individual', true, 40),
  ('d5_other_work',       'Other work-related expenses',     'individual', true, 50),
  ('d9_gifts',            'Gifts & donations',               'individual', true, 60),
  ('d10_managing_tax',    'Cost of managing tax affairs',    'individual', true, 70),
  ('d_interest_dividend', 'Interest / dividend deductions',  'individual', true, 80),
  -- Rental property schedule
  ('rental_interest',     'Rental — loan interest',          'rental', true, 110),
  ('rental_rates',        'Rental — council rates',          'rental', true, 120),
  ('rental_water',        'Rental — water',                  'rental', true, 130),
  ('rental_land_tax',     'Rental — land tax',               'rental', true, 140),
  ('rental_agent',        'Rental — agent fees / commission','rental', true, 150),
  ('rental_repairs',      'Rental — repairs & maintenance',  'rental', true, 160),
  ('rental_insurance',    'Rental — insurance',              'rental', true, 170),
  ('rental_depreciation', 'Rental — capital works / depreciation', 'rental', true, 180),
  ('rental_other',        'Rental — other expenses',         'rental', true, 190),
  -- Business / entity (mainly Phase 2)
  ('business_expense',    'Business / entity expense',       'business', true, 210),
  ('asic_fees',           'ASIC / company fees',             'business', true, 220),
  -- Explicit non-deductible bucket so private spend can be marked and excluded
  ('not_deductible',      'Not deductible (private/domestic)', 'not_deductible', false, 900)
on conflict (code) do nothing;
