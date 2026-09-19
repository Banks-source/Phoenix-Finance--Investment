-- Extra Redbark detail per transaction, shown when you open a row in Review.
alter table transactions
  add column if not exists bank_txn_id text,
  add column if not exists posted_at timestamptz,
  add column if not exists post_date date,
  add column if not exists reference text,
  add column if not exists extended_description text,
  add column if not exists provider_category text,
  add column if not exists merchant_category_code text,
  add column if not exists bank_status text;

create index if not exists transactions_reference_idx on transactions (reference) where reference is not null;
create index if not exists transactions_bank_txn_id_idx on transactions (bank_txn_id) where bank_txn_id is not null;
