-- 1. Why a row is in Review (set by reconciliation and by re-categorisation).
alter table transactions add column if not exists review_reason text;

-- 2. Merge "Property Interest (ING)" into Investment, and count Investment as
--    an expense. Repayment legs (CBA out / ING in) sit in the same category so
--    they cancel; the loan's interest and fees are the net cost.
update categories set type = 'bills_fixed' where name = 'Investment';

insert into sub_categories (category, name) values
  ('Investment', 'Loan Interest'),
  ('Investment', 'Loan Fees'),
  ('Investment', 'Loan Repayment')
on conflict (category, name) do nothing;

update transactions set category = 'Investment' where category = 'Property Interest (ING)';
update transactions set sub_category = 'Loan Repayment' where category = 'Investment' and sub_category = 'Ashby Loan';
update transactions set sub_category = 'Loan Interest'  where category = 'Investment' and sub_category in ('Ashby loan interest', 'Ashby Loan Interest');
update transactions set sub_category = 'Loan Fees'      where category = 'Investment' and sub_category in ('Ashby Loan Fees');
update transactions set type = 'bills_fixed' where category = 'Investment';

update merchant_rules set category = 'Investment', type = 'bills_fixed' where category = 'Property Interest (ING)';
delete from category_budgets where category = 'Property Interest (ING)';
delete from alert_rules where category = 'Property Interest (ING)';
delete from sub_categories where category = 'Property Interest (ING)';
delete from sub_categories where category = 'Investment' and name = 'Ashby Loan';
delete from categories where name = 'Property Interest (ING)';

-- 3. Redo these from a categorisation perspective: every 2026 Investment row,
--    everything on the ING accounts, and anything naming the Ashby loan.
update transactions t
set status = 'pending_review',
    review_reason = 'Re-categorise: Investment now includes the ING loan interest and counts as an expense'
where t.date >= '2026-01-01'
  and (
    t.category = 'Investment'
    or t.detail ilike '%ashby%'
    or t.account_id in (select id from accounts where institution ilike '%ING%')
  );
