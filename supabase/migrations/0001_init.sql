-- Phoenix Finance v1 — initial schema
-- Single combined store (see SOLUTION_DESIGN.md §4 for the partition decision + risk note).

create type txn_type as enum ('spending', 'bills_fixed', 'transfers', 'debt', 'income', 'needs_categorisation');
create type owner_t as enum ('lloyd', 'milani', 'joint');
create type txn_status as enum ('approved', 'pending_review');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  institution text not null,               -- 'NAB' | 'CBA'
  account_label text not null,
  account_number_masked text,
  owner owner_t not null,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type txn_type not null,
  notes text
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(12,2) not null,
  account_id uuid references accounts(id),
  owner owner_t not null,
  transaction_type text,
  detail text,
  merchant text,
  category text references categories(name),
  sub_category text,
  type txn_type not null,
  status txn_status not null default 'approved',
  confidence numeric(3,2),
  source text not null default 'historical_import',  -- 'historical_import' | 'bank_import' | 'manual'
  created_at timestamptz not null default now()
);
create index idx_transactions_date on transactions(date);
create index idx_transactions_owner on transactions(owner);
create index idx_transactions_status on transactions(status);
create index idx_transactions_type on transactions(type);

create table merchant_rules (
  id uuid primary key default gen_random_uuid(),
  merchant_pattern text not null,
  category text not null,
  sub_category text,
  type txn_type not null,
  match_count int not null default 1,
  last_used timestamptz not null default now(),
  unique(merchant_pattern)
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  category_or_type text not null,   -- either a category name or a txn_type value
  month date not null,              -- first day of month
  target_amount numeric(12,2) not null,
  unique(category_or_type, month)
);

-- Seed the locked category taxonomy (PRD.md §7)
insert into categories (name, type) values
  ('Dining Out','spending'),
  ('Shopping','spending'),
  ('Groceries','spending'),
  ('Kids','spending'),
  ('Health','spending'),
  ('Travel','spending'),
  ('Personal Care','spending'),
  ('Pets','spending'),
  ('Entertainment','spending'),
  ('Donations','spending'),
  ('Gambling','spending'),
  ('Fines','spending'),
  ('Car & Transport','spending'),
  ('Transport','spending'),
  ('Subscriptions','bills_fixed'),
  ('Rent','bills_fixed'),
  ('Insurance','bills_fixed'),
  ('Utilities','bills_fixed'),
  ('Bills','bills_fixed'),
  ('Fees','bills_fixed'),
  ('Investment','transfers'),
  ('Money Movement','transfers'),
  ('Income','income'),
  ('Financial','needs_categorisation');
