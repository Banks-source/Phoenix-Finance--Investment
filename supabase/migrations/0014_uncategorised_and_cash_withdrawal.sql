-- 1. Rename "Financial" -> "Uncategorised" and count it as spending (so it
--    shows up in the Overview's Expenses total instead of silently being
--    excluded while unreviewed).
-- 2. Give Cash Withdrawal its own top-level expense category instead of a
--    Money Movement sub-category (it was needs_categorisation there, so it
--    never counted as spend even though the cash is presumed spent).

insert into categories (name, type) values ('Uncategorised', 'spending') on conflict (name) do nothing;
insert into categories (name, type) values ('Cash Withdrawal', 'spending') on conflict (name) do nothing;

update transactions set category = 'Uncategorised', type = 'spending' where category = 'Financial';
update sub_categories set category = 'Uncategorised' where category = 'Financial';
delete from categories where name = 'Financial';

update transactions
  set category = 'Cash Withdrawal', sub_category = null, type = 'spending'
  where category = 'Money Movement' and sub_category in ('Cash Withdrawal', 'Cash Withdrawl');
delete from sub_categories where category = 'Money Movement' and name in ('Cash Withdrawal', 'Cash Withdrawl');
insert into sub_categories (category, name) values ('Cash Withdrawal', 'Other') on conflict (category, name) do nothing;
