import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { searchTransactions, listAccounts, getWalletDetail } from "./tools";

function fakePool(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { pool: { query } as unknown as Pool, query };
}

describe("searchTransactions", () => {
  it("builds no WHERE clause and a default limit when no filters given", async () => {
    const { pool, query } = fakePool();
    await searchTransactions(pool, {});
    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toMatch(/where/i);
    expect(sql).toMatch(/limit \$1/);
    expect(params).toEqual([100]);
  });

  it("adds a clause per provided filter, in order, with matching placeholders", async () => {
    const { pool, query } = fakePool();
    await searchTransactions(pool, {
      from: "2026-01-01",
      to: "2026-01-31",
      owner: "lloyd",
      category: "Groceries",
      merchant: "Woolworths",
      type: "spending",
      status: "approved",
      limit: 50,
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/date >= \$1/);
    expect(sql).toMatch(/date <= \$2/);
    expect(sql).toMatch(/owner = \$3/);
    expect(sql).toMatch(/category = \$4/);
    expect(sql).toMatch(/merchant ilike \$5/);
    expect(sql).toMatch(/type = \$6/);
    expect(sql).toMatch(/status = \$7/);
    expect(sql).toMatch(/limit \$8/);
    expect(params).toEqual([
      "2026-01-01",
      "2026-01-31",
      "lloyd",
      "Groceries",
      "%Woolworths%",
      "spending",
      "approved",
      50,
    ]);
  });

  it("clamps limit to the 1-500 range", async () => {
    const { pool, query } = fakePool();
    await searchTransactions(pool, { limit: 10000 });
    expect(query.mock.calls[0][1]).toEqual([500]);

    const { pool: pool2, query: query2 } = fakePool();
    await searchTransactions(pool2, { limit: 0 });
    expect(query2.mock.calls[0][1]).toEqual([1]);
  });

  it("returns the rows from the query result", async () => {
    const rows = [{ date: "2026-01-01", amount: -10, merchant: "Woolworths" }];
    const { pool } = fakePool(rows);
    const result = await searchTransactions(pool, {});
    expect(result).toBe(rows);
  });
});

describe("listAccounts", () => {
  it("has no WHERE clause when owner is omitted", async () => {
    const { pool, query } = fakePool();
    await listAccounts(pool);
    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toMatch(/where/i);
    expect(params).toEqual([]);
  });

  it("filters by owner when given", async () => {
    const { pool, query } = fakePool();
    await listAccounts(pool, "milani");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/owner = \$1/);
    expect(params).toEqual(["milani"]);
  });
});

describe("getWalletDetail", () => {
  it("has no WHERE clause when no portfolio name given, and dedupes to one row per portfolio", async () => {
    const { pool, query } = fakePool();
    await getWalletDetail(pool);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/distinct on \(kubera_portfolio_id\)/);
    expect(sql).not.toMatch(/where/i);
    expect(params).toEqual([]);
  });

  it("filters by portfolio name substring, case-insensitive", async () => {
    const { pool, query } = fakePool();
    await getWalletDetail(pool, "SMSF");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/portfolio_name ilike \$1/);
    expect(params).toEqual(["%SMSF%"]);
  });
});
