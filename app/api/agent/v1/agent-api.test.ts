import { describe, it, expect, vi } from "vitest";

// The design principle (#12) is that this router is structurally read-only —
// not by convention, by construction: no route file in /api/agent/v1 may
// export POST/PUT/PATCH/DELETE at all. This test imports every route module
// and asserts that directly, so adding a write handler to any of them fails
// the suite rather than relying on someone remembering the rule.

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
  }),
}));
vi.mock("@/lib/allocation", () => ({
  fetchAllocationSummary: async () => ({ sleeves: [], propertyAud: 0, legacyAud: 0, investableTotalAud: 0, unmappedHoldings: [], legacyPositions: [] }),
  fetchNetWorthHistory: async () => [],
}));
vi.mock("@/lib/hardRules", () => ({
  evaluateAllHardRules: async () => [],
  HARD_RULES_VERSION: 1,
  HARD_RULE_DEFINITIONS: [],
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
