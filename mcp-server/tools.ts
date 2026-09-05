import type { Pool } from "pg";

// Tier-B tools: transaction search, account-level holdings, wallet detail
// (see #14 acceptance criteria). All read-only — the mcp_readonly Postgres
// role this connects with has no write grants at all, so a write here would
// fail at the database regardless of anything in this file.

class WhereBuilder {
  private clauses: string[] = [];
  private params: unknown[] = [];

  add(condition: (placeholder: string) => string, value: unknown | undefined) {
    if (value === undefined || value === null || value === "") return;
    this.params.push(value);
    this.clauses.push(condition(`$${this.params.length}`));
  }

  sql(): string {
    return this.clauses.length ? `where ${this.clauses.join(" and ")}` : "";
  }

  values(): unknown[] {
    return this.params;
  }

  nextPlaceholder(): string {
    return `$${this.params.length + 1}`;
  }

  pushRaw(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

export interface SearchTransactionsFilters {
  from?: string;
  to?: string;
  owner?: string;
  category?: string;
  merchant?: string;
  type?: string;
  status?: string;
  limit?: number;
}

export async function searchTransactions(pool: Pool, filters: SearchTransactionsFilters) {
  const w = new WhereBuilder();
  w.add((p) => `date >= ${p}`, filters.from);
  w.add((p) => `date <= ${p}`, filters.to);
  w.add((p) => `owner = ${p}`, filters.owner);
  w.add((p) => `category = ${p}`, filters.category);
  w.add((p) => `merchant ilike ${p}`, filters.merchant ? `%${filters.merchant}%` : undefined);
  w.add((p) => `type = ${p}`, filters.type);
  w.add((p) => `status = ${p}`, filters.status);

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const limitPlaceholder = w.pushRaw(limit);

  const { rows } = await pool.query(
    `select date, amount, owner, transaction_type, detail, merchant, category, sub_category, type, status, source
     from transactions
     ${w.sql()}
     order by date desc
     limit ${limitPlaceholder}`,
    w.values()
  );
  return rows;
}

export async function listAccounts(pool: Pool, owner?: string) {
  const w = new WhereBuilder();
  w.add((p) => `owner = ${p}`, owner);
  const { rows } = await pool.query(
    `select institution, account_label, account_number_masked, owner,
            (redbark_account_id is not null) as bank_feed_linked
     from accounts
     ${w.sql()}
     order by institution, account_label`,
    w.values()
  );
  return rows;
}

export async function getWalletDetail(pool: Pool, portfolioName?: string) {
  const w = new WhereBuilder();
  w.add((p) => `portfolio_name ilike ${p}`, portfolioName ? `%${portfolioName}%` : undefined);
  const { rows } = await pool.query(
    `select distinct on (kubera_portfolio_id)
            kubera_portfolio_id, portfolio_name, currency, net_worth, total_assets, total_debts,
            synced_at, assets, debts
     from portfolio_snapshots
     ${w.sql()}
     order by kubera_portfolio_id, synced_at desc`,
    w.values()
  );
  return rows;
}
