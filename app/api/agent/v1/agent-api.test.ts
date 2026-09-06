import { describe, it, expect, vi } from "vitest";

// The design principle (#12) is that this router is structurally read-only —
// not by convention, by construction: no route file in /api/agent/v1 may
// export POST/PUT/PATCH/DELETE at all. This test imports every route module
// and asserts that directly, so adding a write handler to any of them fails
// the suite rather than relying on someone remembering the rule.

function chain(): any {
  const resolved = Promise.resolve({ data: [], error: null });
  const obj: any = {
    select: () => obj,
    eq: () => obj,
    order: () => resolved,
    maybeSingle: () => resolved,
    then: resolved.then.bind(resolved),
  };
  return obj;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => chain() }),
}));
vi.mock("@/lib/allocation", () => ({
  fetchAllocationSummary: async () => ({
    sleeves: [],
    propertyAud: 0,
    legacyAud: 0,
    investableTotalAud: 0,
    unmappedHoldings: [],
    legacyPositions: [],
    groupTotals: {
      personal: { grossAud: 0, debtsAud: 0, netAud: 0 },
      retirement: { grossAud: 0, debtsAud: 0, netAud: 0 },
      ungrouped: { grossAud: 0, debtsAud: 0, netAud: 0 },
    },
  }),
  fetchNetWorthHistory: async () => [],
}));
vi.mock("@/lib/hardRules", () => ({
  evaluateAllHardRules: async () => [],
  HARD_RULES_VERSION: 1,
  fetchHardRuleParams: async () => ({ btc_pct_of_nw_max: 40, single_asset_pct_max: 15, lvr_pct_max: 30, liquidity_months: 3 }),
  getHardRuleDefinitions: () => [],
}));
vi.mock("@/lib/quarterlyReviewServer", () => ({
  fetchKillCriteriaStatus: async () => [],
}));
vi.mock("@/lib/queries", () => ({
  fetchCategoryTotals: async () => [],
}));

const ROUTE_MODULES = [
  () => import("./allocation/route"),
  () => import("./net-worth/route"),
  () => import("./hard-rules/route"),
  () => import("./kill-criteria/route"),
  () => import("./thesis/route"),
  () => import("./legacy-positions/route"),
  () => import("./spend-summary/route"),
];

describe("Agent API v1 — structurally read-only", () => {
  it.each(ROUTE_MODULES.map((load, i) => [i, load] as const))("route module %i exports GET only, no write verbs", async (_i, load) => {
    const mod = (await load()) as Record<string, unknown>;
    expect(typeof mod.GET).toBe("function");
    expect(mod.POST).toBeUndefined();
    expect(mod.PUT).toBeUndefined();
    expect(mod.PATCH).toBeUndefined();
    expect(mod.DELETE).toBeUndefined();
  });
});
