-- Sub-categories rule engine: the canonical, curated list of sub-categories
-- per category. Categories themselves stay defined in code (lib/taxonomy.ts);
-- this table is additive-only from the app's UI (see /settings/categories) —
-- rows are inserted, never edited or deleted through the app.

-- Added ad-hoc via script earlier in the session — repeated here so this
-- migration is self-contained on a fresh database too.
insert into categories (name, type)
values ('Family Assistance', 'bills_fixed')
on conflict (name) do nothing;

create table sub_categories (
  id uuid primary key default gen_random_uuid(),
  category text not null references categories(name),
  name text not null,
  created_at timestamptz not null default now(),
  unique (category, name)
);

alter table sub_categories enable row level security;

insert into sub_categories (category, name) values
  ('Dining Out', 'Fast Food'),
  ('Dining Out', 'Cafe & Coffee'),
  ('Dining Out', 'Pubs & Bars'),
  ('Dining Out', 'Restaurants & Takeaway'),
  ('Dining Out', 'Delivery'),
  ('Dining Out', 'Clubs'),
  ('Dining Out', 'Other'),

  ('Shopping', 'Buy Now Pay Later'),
  ('Shopping', 'Amazon'),
  ('Shopping', 'Department Store'),
  ('Shopping', 'Discount & Variety'),
  ('Shopping', 'Sporting Goods'),
  ('Shopping', 'Other'),

  ('Groceries', 'Coles'),
  ('Groceries', 'Woolworths'),
  ('Groceries', 'Aldi'),
  ('Groceries', 'Butcher'),
  ('Groceries', 'Convenience'),
  ('Groceries', 'Liquor'),
  ('Groceries', 'Other'),

  ('Kids', 'School Fees'),
  ('Kids', 'School Extras'),
  ('Kids', 'Sport'),
  ('Kids', 'Entertainment'),
  ('Kids', 'Other'),

  ('Car & Transport', 'Rideshare'),
  ('Car & Transport', 'Fuel'),
  ('Car & Transport', 'Parking & Tolls'),
  ('Car & Transport', 'Car Wash'),
  ('Car & Transport', 'Government'),
  ('Car & Transport', 'Other'),

  ('Subscriptions', 'AI & Software'),
  ('Subscriptions', 'Streaming'),
  ('Subscriptions', 'Apple'),
  ('Subscriptions', 'Google'),
  ('Subscriptions', 'Microsoft'),
  ('Subscriptions', 'Other'),

  ('Fees', 'International Fee'),
  ('Fees', 'Interest Charged'),
  ('Fees', 'Account Fee'),
  ('Fees', 'Other'),

  ('Health', 'Medicare'),
  ('Health', 'Pharmacy'),
  ('Health', 'Medical & Dental'),
  ('Health', 'Wellness'),
  ('Health', 'Other'),

  ('Insurance', 'NRMA'),
  ('Insurance', 'PetSure'),
  ('Insurance', 'RACV'),
  ('Insurance', 'Medibank'),
  ('Insurance', 'Other'),

  ('Investment', 'Ashby Loan'),
  ('Investment', 'Ashby Loan Interest'),
  ('Investment', 'Ashby Loan Fees'),
  ('Investment', 'Property Rates & Government'),
  ('Investment', 'Other'),

  ('Money Movement', 'Internal transfer'),
  ('Money Movement', 'External transfer'),
  ('Money Movement', 'Card payment'),
  ('Money Movement', 'Cash Withdrawal'),
  ('Money Movement', 'ZipMoney'),
  ('Money Movement', 'Centrelink'),
  ('Money Movement', 'Needs review'),

  ('Income', 'Lloyd Salary'),
  ('Income', 'Milani Salary'),
  ('Income', 'Rent'),
  ('Income', 'Taxes'),
  ('Income', 'Other Income'),

  ('Family Assistance', 'Rudy'),
  ('Family Assistance', 'Other'),

  ('Bills', 'Local Government'),
  ('Bills', 'Other'),

  ('Financial', 'Uncategorised'),

  ('Utilities', 'Phone & Internet'),
  ('Utilities', 'Energy'),
  ('Utilities', 'Strata & Body Corporate'),
  ('Utilities', 'Other'),

  ('Rent', 'Rent Payment'),
  ('Rent', 'Other'),

  ('Personal Care', 'Nails & Beauty'),
  ('Personal Care', 'Hair'),
  ('Personal Care', 'Other'),

  ('Pets', 'Pet Store'),
  ('Pets', 'Vet'),
  ('Pets', 'Pet Care'),
  ('Pets', 'Other'),

  ('Transport', 'Public Transport'),
  ('Transport', 'Other'),

  ('Fines', 'Government Penalty'),
  ('Fines', 'Centrelink'),
  ('Fines', 'Other'),

  ('Travel', 'Accommodation'),
  ('Travel', 'Flights'),
  ('Travel', 'Other'),

  ('Gambling', 'Lottery'),
  ('Gambling', 'Casino'),
  ('Gambling', 'Sports Betting'),
  ('Gambling', 'Other'),

  ('Donations', 'Charity'),
  ('Donations', 'Other'),

  -- Not seen in the current review batch yet, but defined in the taxonomy —
  -- seeded with a placeholder so every category has somewhere to start;
  -- add more from /settings/categories as real data shows up.
  ('Entertainment', 'Other')
on conflict (category, name) do nothing;
