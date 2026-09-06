import { describe, it, expect, vi, beforeEach } from "vitest";

let tableData: Record<string, unknown[]>;

function makeSelect(rows: unknown[]) {
  const resolved = Promise.resolve({ data: rows, error: null });
  return {
    order: () => resolved,
    then: resolved.then.bind(resolved),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => makeSelect(tableData[table] ?? []),
    }),
  }),
}));

// Fixed, simple rates so allocation tests don't depend on lib/fx's real HTTP call.
vi.mock("@/lib/fx", () => ({
  convert: async (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    if (from === "USD" && to === "AUD") return amount * 1.5;
    throw new Error(`unhandled test FX pair ${from}->${to}`);
  },
}));

beforeEach(() => {
  tableData = {
    portfolio_snapshots: [],
    portfolio_groups: [],
    sleeve_overrides: [],
    sleeve_targets: [],
    legacy_positions: [],
  };
});

describe("fetchClassifiedHoldings", () => {
  it("classifies assets via the automatic rules and includes debts unclassified", async () => {
    tableData.portfolio_snapshots = [
      {
        kubera_portfolio_id: "conn_1",
        portfolio_name: "Lloyd",
        synced_at: "2026-09-05T00:00:00Z",
        assets: [
          { id: "a1", name: "Bitcoin", assetClass: "crypto", value: { amount: 100, currency: "USD" } },
          { id: "a2", name: "Australian Dollars", assetClass: "cash", value: { amount: 500, currency: "AUD" } },
          { id: "a3", name: "Ashby Crt", assetClass: "investment", value: { amount: 740000, currency: "AUD" } },
          { id: "a4", name: "Goodman Group", assetClass: "stock", value: { amount: 368, currency: "AUD" } },
        ],
        debts: [{ id: "d1", name: "Westpac - Flexi Loan", value: { amount: 53951.91, currency: "AUD" } }],
      },
    ];
    tableData.portfolio_groups = [{ kubera_portfolio_id: "conn_1", group_name: "personal" }];

    const { fetchClassifiedHoldings } = await import("./allocation");
    const rows = await fetchClassifiedHoldings();

    expect(rows).toHaveLength(5);
    const byId = Object.fromEntries(rows.map((r) => [r.assetId, r]));
    expect(byId.a1).toMatchObject({ sleeve: "btc_crypto", method: "crypto_rule", group: "personal" });
    expect(byId.a2).toMatchObject({ sleeve: "dry_powder", method: "cash_rule" });
    expect(byId.a3).toMatchObject({ sleeve: "property", method: "property_rule" });
    expect(byId.a4).toMatchObject({ sleeve: null, method: "unmapped" });
    expect(byId.d1).toMatchObject({ sleeve: null, isDebt: true, amount: 53951.91 });
  });

  it("applies a sleeve_overrides row instead of the automatic rule", async () => {
    tableData.portfolio_snapshots = [
      {
        kubera_portfolio_id: "conn_2",
        portfolio_name: "SMSF",
        synced_at: "2026-09-05T00:00:00Z",
        assets: [{ id: "b1", name: "Biofuels", assetClass: "investment", value: { amount: 108640, currency: "AUD" } }],
        debts: [],
      },
    ];
    tableData.sleeve_overrides = [{ kubera_portfolio_id: "conn_2", asset_id: "b1", sleeve: "legacy" }];

    const { fetchClassifiedHoldings } = await import("./allocation");
    const rows = await fetchClassifiedHoldings();

    expect(rows[0]).toMatchObject({ sleeve: "legacy", method: "override", group: null });
  });

  it("leaves group null for a portfolio with no portfolio_groups row, rather than guessing", async () => {
    tableData.portfolio_snapshots = [
      {
        kubera_portfolio_id: "conn_3",
        portfolio_name: "New Portfolio",
        synced_at: "2026-09-05T00:00:00Z",
        assets: [{ id: "c1", name: "Bitcoin", assetClass: "crypto", value: { amount: 10, currency: "USD" } }],
        debts: [],
      },
    ];

    const { fetchClassifiedHoldings } = await import("./allocation");
    const rows = await fetchClassifiedHoldings();

    expect(rows[0].group).toBeNull();
  });

  it("only uses the latest snapshot per portfolio, not every historical one", async () => {
    tableData.portfolio_snapshots = [
      {
        kubera_portfolio_id: "conn_1",
        portfolio_name: "Lloyd",
        synced_at: "2026-09-05T00:00:00Z",
        assets: [{ id: "new", name: "Bitcoin", assetClass: "crypto", value: { amount: 200, currency: "USD" } }],
        debts: [],
      },
      {
        kubera_portfolio_id: "conn_1",
        portfolio_name: "Lloyd",
        synced_at: "2026-09-04T00:00:00Z",
        assets: [{ id: "old", name: "Bitcoin", assetClass: "crypto", value: { amount: 100, currency: "USD" } }],
        debts: [],
      },
    ];

    const { fetchClassifiedHoldings } = await import("./allocation");
    const rows = await fetchClassifiedHoldings();

    expect(rows).toHaveLength(1);
    expect(rows[0].assetId).toBe("new");
  });
});

describe("fetchAllocationSummary", () => {
  function withHoldings() {
    tableData.portfolio_snapshots = [
      {
        kubera_portfolio_id: "conn_smsf",
        portfolio_name: "SMSF",
        synced_at: "2026-09-05T00:00:00Z",
        assets: [
          { id: "s1", name: "Bitcoin", assetClass: "crypto", value: { amount: 1000, currency: "USD" } }, // -> 1500 AUD
          { id: "s2", name: "Biofuels", assetClass: "investment", value: { amount: 500, currency: "AUD" } },
        ],
        debts: [],
      },
      {
        kubera_portfolio_id: "conn_lloyd",
        portfolio_name: "Lloyd",
        synced_at: "2026-09-05T00:00:00Z",
        assets: [
          { id: "l1", name: "Australian Dollars", assetClass: "cash", value: { amount: 300, currency: "AUD" } },
          { id: "l2", name: "Ashby Crt", assetClass: "investment", value: { amount: 700, currency: "AUD" } },
          { id: "l3", name: "Goodman Group", assetClass: "stock", value: { amount: 200, currency: "AUD" } },
        ],
        debts: [{ id: "ld1", name: "Some Loan", value: { amount: 999, currency: "AUD" } }],
      },
    ];
    tableData.portfolio_groups = [
      { kubera_portfolio_id: "conn_smsf", group_name: "retirement" },
      { kubera_portfolio_id: "conn_lloyd", group_name: "personal" },
    ];
    tableData.legacy_positions = [
      {
        kubera_portfolio_id: "conn_smsf",
        asset_id: "s2",
        reason: "Illiquid and co-invested — breaches hard rule 1",
        breached_rule: 1,
        review_date: "2026-12-01",
        decision: null,
      },
    ];
  }

  it("converts to AUD, splits crypto by group, and buckets property/legacy/unmapped correctly", async () => {
    withHoldings();
    const { fetchAllocationSummary } = await import("./allocation");
    const summary = await fetchAllocationSummary();

    const crypto = summary.sleeves.find((s) => s.sleeve === "btc_crypto")!;
    expect(crypto.retirementAud).toBeCloseTo(1500, 6); // 1000 USD * 1.5
    expect(crypto.personalAud).toBe(0);

    const dryPowder = summary.sleeves.find((s) => s.sleeve === "dry_powder")!;
    expect(dryPowder.personalAud).toBe(300);

    expect(summary.propertyAud).toBe(700); // Ashby Crt
    expect(summary.legacyAud).toBe(500); // Biofuels only — it has a legacy_positions row
    expect(summary.legacyPositions).toHaveLength(1);
    expect(summary.legacyPositions[0]).toMatchObject({ assetId: "s2", reason: expect.stringContaining("Illiquid"), breachedRule: 1 });
    expect(summary.unmappedHoldings.map((h) => h.assetId)).toEqual(["l3"]); // Goodman Group — genuinely unclassified, no sleeve and no legacy row

    // investable total excludes debts: 1500 (crypto) + 300 (dry powder) + 700 (property) + 500 (legacy) + 200 (unmapped) = 3200
    expect(summary.investableTotalAud).toBeCloseTo(3200, 6);
  });

  it("computes pctOfInvestable and leaves breach null when no target is set", async () => {
    withHoldings();
    const { fetchAllocationSummary } = await import("./allocation");
    const summary = await fetchAllocationSummary();
    const crypto = summary.sleeves.find((s) => s.sleeve === "btc_crypto")!;
    expect(crypto.pctOfInvestable).toBeCloseTo((1500 / 3200) * 100, 6);
    expect(crypto.minPct).toBeNull();
    expect(crypto.breach).toBeNull();
  });

  it("flags a breach when pctOfInvestable falls outside the target band", async () => {
    withHoldings();
    tableData.sleeve_targets = [{ sleeve: "btc_crypto", min_pct: 60, max_pct: 80 }];
    const { fetchAllocationSummary } = await import("./allocation");
    const summary = await fetchAllocationSummary();
    const crypto = summary.sleeves.find((s) => s.sleeve === "btc_crypto")!;
    // 1500/3200 = 46.9% — under the 60% floor
    expect(crypto.breach).toBe("under");
  });

  it("does not flag a breach when pctOfInvestable is within the target band", async () => {
    withHoldings();
    tableData.sleeve_targets = [{ sleeve: "btc_crypto", min_pct: 10, max_pct: 90 }];
    const { fetchAllocationSummary } = await import("./allocation");
    const summary = await fetchAllocationSummary();
    const crypto = summary.sleeves.find((s) => s.sleeve === "btc_crypto")!;
    expect(crypto.breach).toBeNull();
  });
});
