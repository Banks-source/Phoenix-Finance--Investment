-- Bank logos on the dashboard (Redbark supplies institution.logo), and a
-- "Debt paydown" sub-category so a real paydown of the Westpac Flexi Loan
-- can be told apart from a temporary buffer top-up (Internal transfer).
-- Both are non-expense: only the loan's interest/fees count as spend.
alter table accounts add column if not exists institution_logo text;

insert into sub_categories (category, name) values ('Money Movement', 'Debt paydown')
on conflict (category, name) do nothing;
