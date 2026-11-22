-- Categorisation memory: where each rule came from, and an example of what it was learned from.
alter table merchant_rules add column if not exists source text not null default 'user';
alter table merchant_rules add column if not exists sample text;
alter table merchant_rules add column if not exists updated_at timestamptz not null default now();

alter table merchant_rules drop constraint if exists merchant_rules_source_check;
alter table merchant_rules add constraint merchant_rules_source_check check (source in ('user', 'confirmed', 'history'));
