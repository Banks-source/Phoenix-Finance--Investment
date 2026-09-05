import { describe, it, expect, vi, beforeEach } from "vitest";

const listConnectionsMock = vi.fn();
const listAccountsMock = vi.fn();
const listTransactionsMock = vi.fn();

vi.mock("@/lib/redbark", () => ({
  listConnections: (...args: any[]) => listConnectionsMock(...args),
  listAccounts: (...args: any[]) => listAccountsMock(...args),
  listTransactions: (...args: any[]) => listTransactionsMock(...args),
}));

// In-memory fake covering exactly the call shapes redbarkSync.ts uses:
//   .from(t).select(...)                              -> resolves table's `rows`
//   .from("accounts").select(...).eq(...).maybeSingle() -> looks up accountsByRedbarkId
//   .from("accounts").insert(row).select("id").single() -> pushes + returns a fresh id
//   .from("accounts").update(row).eq("id", id)          -> records the update
//   .from("transactions").insert(rows)                  -> records inserted rows
let state: {
  redbarkAccountOwners: { redbark_account_id: string; owner: string }[];
  merchantRules: any[];
  existingTransactions: { date: string; amount: number; detail: string; owner: string }[];
  accountsByRedbarkId: Record<string, { id: string; redbark_last_synced_at: string | null }>;
  insertedTransactions: any[];
  insertedAccounts: any[];
  updatedAccounts: { id: string; redbark_last_synced_at: string }[];
  transactionsInsertError: { message: string } | null;
};

function resetState() {
  state = {
    redbarkAccountOwners: [],
    merchantRules: [],
    existingTransactions: [],
    accountsByRedbarkId: {},
    insertedTransactions: [],
    insertedAccounts: [],
    updatedAccounts: [],
    transactionsInsertError: null,
  };
}

function fakeFrom(table: string) {
  const chain: any = {
    select: (_cols?: string) => chain,
    eq: (col: string, val: string) => {
      chain.__eqCol = col;
      chain.__eqVal = val;
      return chain;
    },
    maybeSingle: () => {
      const row = state.accountsByRedbarkId[chain.__eqVal];
      return Promise.resolve({ data: row ?? null, error: null });
    },
    single: () => {
      const id = `acct-row-${state.insertedAccounts.length + 1}`;
      const row = { ...chain.__insertRow, id };
      state.insertedAccounts.push(row);
      state.accountsByRedbarkId[row.redbark_account_id] = { id, redbark_last_synced_at: null };
      return Promise.resolve({ data: { id }, error: null });
    },
    insert: (rowOrRows: any) => {
      if (table === "transactions") {
        state.insertedTransactions.push(...rowOrRows);
        return Promise.resolve({ error: state.transactionsInsertError });
      }
      chain.__insertRow = rowOrRows;
      return chain;
    },
    update: (row: any) => {
      chain.__updateRow = row;
      return chain;
    },
    then: (onFulfilled: any) => {
      // Only reached for a bare `.select(...)` with no further chaining.
      let data: any = [];
      if (table === "redbark_account_owners") data = state.redbarkAccountOwners;
      if (table === "merchant_rules") data = state.merchantRules;
      if (table === "transactions") data = state.existingTransactions;
      return Promise.resolve({ data, error: null }).then(onFulfilled);
    },
  };
  // .update(...).eq("id", id) resolves here instead of via select/then.
  const originalEq = chain.eq;
  chain.eq = (col: string, val: string) => {
    if (chain.__updateRow && col === "id") {
      state.updatedAccounts.push({ id: val, redbark_last_synced_at: chain.__updateRow.redbark_last_synced_at });
      return Promise.resolve({ error: null });
    }
    return originalEq(col, val);
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => fakeFrom(table) }),
}));

beforeEach(() => {
  resetState();
  listConnectionsMock.mockReset();
  listAccountsMock.mockReset();
  listTransactionsMock.mockReset();
});

const activeBankingConnection = { id: "conn_1", status: "active", category: "banking" };

describe("runRedbarkSync", () => {
  it("skips accounts with no owner mapping and reports them", async () => {
    listConnectionsMock.mockResolvedValue([activeBankingConnection]);
    listAccountsMock.mockResolvedValue([
      { id: "acct_1", name: "Everyday", institution: { name: "NAB" } },
    ]);

    const { runRedbarkSync } = await import("./redbarkSync");
    const result = await runRedbarkSync();

    expect(result.unmappedAccounts).toEqual([{ id: "acct_1", name: "Everyday", institution: "NAB" }]);
    expect(result.imported).toBe(0);
    expect(listTransactionsMock).not.toHaveBeenCalled();
  });

  it("creates a new internal account and imports transactions with correct sign/scale", async () => {
    state.redbarkAccountOwners = [{ redbark_account_id: "acct_1", owner: "lloyd" }];
    listConnectionsMock.mockResolvedValue([activeBankingConnection]);
    listAccountsMock.mockResolvedValue([
      {
        id: "acct_1",
        name: "Everyday",
        institution: { name: "NAB" },
        account_number: "xxxx1234",
      },
    ]);
    listTransactionsMock.mockResolvedValue([
      {
        id: "txn_1",
        date: "2026-03-01",
        description: "Woolworths Sydney",
        amount: { amount: 4550, currency: "aud" },
        direction: "debit",
        merchant_name: "Woolworths",
        provider_category: "FOOD_AND_DRINK",
      },
      {
        id: "txn_2",
        date: "2026-03-02",
        description: "Salary",
        amount: { amount: 100000, currency: "aud" },
        direction: "credit",
        merchant_name: null,
        provider_category: null,
      },
    ]);

    const { runRedbarkSync } = await import("./redbarkSync");
    const result = await runRedbarkSync();

    expect(state.insertedAccounts).toEqual([
      expect.objectContaining({
        institution: "NAB",
        account_label: "Everyday",
        account_number_masked: "xxxx1234",
        owner: "lloyd",
        redbark_account_id: "acct_1",
      }),
    ]);

    expect(state.insertedTransactions).toHaveLength(2);
    expect(state.insertedTransactions[0]).toMatchObject({
      date: "2026-03-01",
      amount: -45.5,
      owner: "lloyd",
      merchant: "Woolworths",
      status: "pending_review",
      source: "bank_import",
    });
    expect(state.insertedTransactions[1]).toMatchObject({
      date: "2026-03-02",
      amount: 1000,
      owner: "lloyd",
    });

    expect(result.imported).toBe(2);
    expect(result.unmappedAccounts).toEqual([]);
    expect(state.updatedAccounts).toHaveLength(1);
  });

  it("skips a transaction that already exists (dedup by date|amount|detail|owner)", async () => {
    state.redbarkAccountOwners = [{ redbark_account_id: "acct_1", owner: "lloyd" }];
    state.existingTransactions = [{ date: "2026-03-01", amount: -45.5, detail: "Woolworths Sydney", owner: "lloyd" }];
    listConnectionsMock.mockResolvedValue([activeBankingConnection]);
    listAccountsMock.mockResolvedValue([{ id: "acct_1", name: "Everyday", institution: { name: "NAB" } }]);
    listTransactionsMock.mockResolvedValue([
      {
        id: "txn_1",
        date: "2026-03-01",
        description: "Woolworths Sydney",
        amount: { amount: 4550, currency: "aud" },
        direction: "debit",
        merchant_name: "Woolworths",
        provider_category: "FOOD_AND_DRINK",
      },
    ]);

    const { runRedbarkSync } = await import("./redbarkSync");
    const result = await runRedbarkSync();

    expect(result.imported).toBe(0);
    expect(result.skippedDuplicates).toBe(1);
    expect(state.insertedTransactions).toHaveLength(0);
  });

  it("uses the account's last-synced date (minus overlap) as the from param", async () => {
    state.redbarkAccountOwners = [{ redbark_account_id: "acct_1", owner: "lloyd" }];
    state.accountsByRedbarkId["acct_1"] = { id: "existing-id", redbark_last_synced_at: "2026-03-10T00:00:00.000Z" };
    listConnectionsMock.mockResolvedValue([activeBankingConnection]);
    listAccountsMock.mockResolvedValue([{ id: "acct_1", name: "Everyday", institution: { name: "NAB" } }]);
    listTransactionsMock.mockResolvedValue([]);

    const { runRedbarkSync } = await import("./redbarkSync");
    await runRedbarkSync();

    expect(listTransactionsMock).toHaveBeenCalledWith(
      "acct_1",
      expect.objectContaining({ from: "2026-03-07", includePending: false })
    );
  });

  it("propagates a Supabase insert error", async () => {
    state.redbarkAccountOwners = [{ redbark_account_id: "acct_1", owner: "lloyd" }];
    state.transactionsInsertError = { message: "insert failed" };
    listConnectionsMock.mockResolvedValue([activeBankingConnection]);
    listAccountsMock.mockResolvedValue([{ id: "acct_1", name: "Everyday", institution: { name: "NAB" } }]);
    listTransactionsMock.mockResolvedValue([
      {
        id: "txn_1",
        date: "2026-03-01",
        description: "Woolworths",
        amount: { amount: 100, currency: "aud" },
        direction: "debit",
        merchant_name: "Woolworths",
        provider_category: null,
      },
    ]);

    const { runRedbarkSync } = await import("./redbarkSync");
    await expect(runRedbarkSync()).rejects.toMatchObject({ message: "insert failed" });
  });
});
