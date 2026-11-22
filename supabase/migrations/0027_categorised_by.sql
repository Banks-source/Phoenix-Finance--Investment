-- Which transactions were placed by the daily job's Claude pass (shown in Review as a suggestion).
alter table transactions add column if not exists categorised_by text;
