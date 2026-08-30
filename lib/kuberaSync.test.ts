import { describe, it, expect, vi, beforeEach } from "vitest";

const listPortfoliosMock = vi.fn();
const getPortfolioDetailMock = vi.fn();
const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createServiceClientMock = vi.fn((..._args: any[]) => ({ from: fromMock }));

vi.mock("@/lib/kubera", () => ({
  listPortfolios: (...args: any[]) => listPortfoliosMock(...args),
  getPortfolioDetail: (...args: any[]) => getPortfolioDetailMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: (...args: any[]) => createServiceClientMock(...args),
}));

beforeEach(() => {
  listPortfoliosMock.mockReset();
  getPortfolioDetailMock.mockReset();
  insertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockClear();
  createServiceClientMock.mockClear();
});

describe("runKuberaSync", () => {
  it("inserts one snapshot row per portfolio with the right shape", async () => {
    listPortfoliosMock.mockResolvedValue([
      { id: "p1", name: "Household", currency: "AUD" },
      { id: "p2", name: "Crypto", currency: "AUD" },
    ]);
    getPortfolioDetailMock.mockImplementation(async (id: string) => ({
      asset: [{ name: "BTC" }],
      debt: [],
      totalAssets: { amount: 1000, currency: "AUD" },
      totalDebts: { amount: 0, currency: "AUD" },
      netWorth: { amount: 1000, currency: "AUD" },
    }));

    const { runKuberaSync } = await import("./kuberaSync");
    const result = await runKuberaSync();

    expect(getPortfolioDetailMock).toHaveBeenCalledWith("p1");
    expect(getPortfolioDetailMock).toHaveBeenCalledWith("p2");
    expect(fromMock).toHaveBeenCalledWith("portfolio_snapshots");
    expect(insertMock).toHaveBeenCalledTimes(1);

    const rows = insertMock.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kubera_portfolio_id: "p1",
      portfolio_name: "Household",
      currency: "AUD",
      total_assets: 1000,
      total_debts: 0,
      net_worth: 1000,
    });
    expect(rows[0].assets).toEqual([{ name: "BTC" }]);

    expect(result.portfolios).toEqual([
      { id: "p1", name: "Household", netWorth: 1000, currency: "AUD" },
      { id: "p2", name: "Crypto", netWorth: 1000, currency: "AUD" },
    ]);
  });

  it("does not call insert when there are no portfolios", async () => {
    listPortfoliosMock.mockResolvedValue([]);
    const { runKuberaSync } = await import("./kuberaSync");
    const result = await runKuberaSync();
    expect(insertMock).not.toHaveBeenCalled();
    expect(result.portfolios).toEqual([]);
  });

  it("propagates a Supabase insert error", async () => {
    listPortfoliosMock.mockResolvedValue([{ id: "p1", name: "Household", currency: "AUD" }]);
    getPortfolioDetailMock.mockResolvedValue({
      asset: [],
      debt: [],
      totalAssets: { amount: 0, currency: "AUD" },
      totalDebts: { amount: 0, currency: "AUD" },
      netWorth: { amount: 0, currency: "AUD" },
    });
    insertMock.mockResolvedValue({ error: { message: "insert failed" } });

    const { runKuberaSync } = await import("./kuberaSync");
    await expect(runKuberaSync()).rejects.toMatchObject({ message: "insert failed" });
  });
});
