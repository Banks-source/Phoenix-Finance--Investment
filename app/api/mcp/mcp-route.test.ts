import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub every data module the tools import — these tests are about the endpoint:
// who can reach it, and which tools each token sees.
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: () => ({ select: () => Promise.resolve({ data: [] }) }) }) }));
vi.mock("@/lib/queries", () => ({
  fetchTransactions: async () => ({ rows: [], count: 0 }),
  fetchAllTransactions: async () => ({ rows: [] }),
  fetchCategoryTotals: async () => [],
  fetchUnreviewedSummary: async () => ({ count: 0, expense: 0, needsCategory: 0 }),
}));
vi.mock("@/lib/budgets", () => ({
  fetchCategoryBudgets: async () => ({}),
  fetchMonthSpendByCategory: async () => ({}),
  fetchYtdAverageByCategory: async () => ({}),
  setCategoryBudget: async () => ({}),
}));
vi.mock("@/lib/balances", () => ({ fetchBalanceSummary: async () => ({ cash: 0, debt: 0, net: 0, accounts: [], observedAt: null }) }));
vi.mock("@/lib/subCategoriesTable", () => ({ fetchAllSubCategoryNames: async () => [] }));
const applyReviewEdit = vi.fn(async () => ({ ok: true, updated: 1, learned: 1, alsoUpdated: 0 }));
vi.mock("@/lib/reviewEdit", () => ({ applyReviewEdit: (...a: unknown[]) => (applyReviewEdit as any)(...a) }));

const READ = "r".repeat(32);
const WRITE = "w".repeat(32);

function rpc(method: string, params: unknown, token?: string, id = 1) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function toolNames(token: string): Promise<string[]> {
  const { POST } = await import("./route");
  const res = await POST(rpc("tools/list", {}, token));
  const body = await res.json();
  return (body.result?.tools ?? []).map((t: { name: string }) => t.name);
}

beforeEach(() => {
  process.env.PHOENIX_MCP_TOKEN = READ;
  process.env.PHOENIX_MCP_WRITE_TOKEN = WRITE;
  applyReviewEdit.mockClear();
});

describe("/api/mcp", () => {
  it("rejects requests with no token or a wrong one", async () => {
    const { POST } = await import("./route");
    expect((await POST(rpc("tools/list", {}))).status).toBe(401);
    expect((await POST(rpc("tools/list", {}, "x".repeat(32)))).status).toBe(401);
  });

  it("is switched off when no token is configured", async () => {
    delete process.env.PHOENIX_MCP_TOKEN;
    delete process.env.PHOENIX_MCP_WRITE_TOKEN;
    const { POST } = await import("./route");
    expect((await POST(rpc("tools/list", {}, READ))).status).toBe(401);
  });

  it("rejects a token that is too short to be safe", async () => {
    process.env.PHOENIX_MCP_TOKEN = "short";
    const { POST } = await import("./route");
    expect((await POST(rpc("tools/list", {}, "short"))).status).toBe(401);
  });

  it("gives the read token only read tools", async () => {
    const names = await toolNames(READ);
    expect(names).toEqual(expect.arrayContaining(["budget_status", "search_transactions", "review_queue", "account_balances"]));
    expect(names).not.toContain("categorise_transactions");
    expect(names).not.toContain("approve_transactions");
  });

  it("gives the write token the edit tools too", async () => {
    const names = await toolNames(WRITE);
    expect(names).toEqual(expect.arrayContaining(["budget_status", "categorise_transactions", "approve_transactions", "set_category_budget"]));
  });

  it("will not run an edit tool for a read token", async () => {
    const { POST } = await import("./route");
    const res = await POST(rpc("tools/call", { name: "categorise_transactions", arguments: { ids: ["a"], category: "Groceries" } }, READ));
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/not found|unknown|error/i);
    expect(applyReviewEdit).not.toHaveBeenCalled();
  });

  it("runs an edit through the shared edit path, and rejects an unknown category", async () => {
    const { POST } = await import("./route");
    const ok = await (await POST(rpc("tools/call", { name: "categorise_transactions", arguments: { ids: ["a"], category: "Groceries" } }, WRITE))).json();
    expect(ok.result.isError).toBeFalsy();
    expect(applyReviewEdit).toHaveBeenCalledWith(expect.objectContaining({ ids: ["a"], category: "Groceries", keepStatus: true }));

    applyReviewEdit.mockClear();
    const bad = await (await POST(rpc("tools/call", { name: "categorise_transactions", arguments: { ids: ["a"], category: "Nonsense" } }, WRITE))).json();
    expect(bad.result.isError).toBe(true);
    expect(applyReviewEdit).not.toHaveBeenCalled();
  });
});
