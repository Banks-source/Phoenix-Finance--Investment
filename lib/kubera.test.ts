import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signRequest, KuberaApiError } from "./kubera";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, KUBERA_API_KEY: "test-key", KUBERA_API_SECRET: "test-secret" };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("signRequest", () => {
  it("is deterministic for identical inputs", () => {
    const a = signRequest("secret", "key", "1000", "GET", "/portfolio", "");
    const b = signRequest("secret", "key", "1000", "GET", "/portfolio", "");
    expect(a).toBe(b);
  });

  it("produces a 64-char hex digest (SHA-256)", () => {
    const sig = signRequest("secret", "key", "1000", "GET", "/portfolio", "");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any input changes", () => {
    const base = signRequest("secret", "key", "1000", "GET", "/portfolio", "");
    expect(signRequest("other-secret", "key", "1000", "GET", "/portfolio", "")).not.toBe(base);
    expect(signRequest("secret", "other-key", "1000", "GET", "/portfolio", "")).not.toBe(base);
    expect(signRequest("secret", "key", "1001", "GET", "/portfolio", "")).not.toBe(base);
    expect(signRequest("secret", "key", "1000", "POST", "/portfolio", "")).not.toBe(base);
    expect(signRequest("secret", "key", "1000", "GET", "/portfolio/1", "")).not.toBe(base);
    expect(signRequest("secret", "key", "1000", "GET", "/portfolio", "{}")).not.toBe(base);
  });
});

describe("listPortfolios / getPortfolioDetail", () => {
  it("sends the required auth headers and parses the data envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "p1", name: "Household", currency: "AUD" }], errorCode: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { listPortfolios } = await import("./kubera");
    const result = await listPortfolios();

    expect(result).toEqual([{ id: "p1", name: "Household", currency: "AUD" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kubera.com/api/v3/data/portfolio");
    expect(init.method).toBe("GET");
    expect(init.headers["x-api-token"]).toBe("test-key");
    expect(init.headers["x-signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(init.headers["x-timestamp"]).toMatch(/^\d+$/);
  });

  it("requests the portfolio-detail path with the given id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          asset: [],
          debt: [],
          totalAssets: { amount: 100, currency: "AUD" },
          totalDebts: { amount: 20, currency: "AUD" },
          netWorth: { amount: 80, currency: "AUD" },
        },
        errorCode: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getPortfolioDetail } = await import("./kubera");
    const detail = await getPortfolioDetail("p1");

    expect(detail.netWorth.amount).toBe(80);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kubera.com/api/v3/data/portfolio/p1");
  });

  it("throws KuberaApiError when errorCode is non-zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: null, errorCode: 401, errorMessage: "bad signature" }),
      })
    );
    const { listPortfolios } = await import("./kubera");
    await expect(listPortfolios()).rejects.toThrow(KuberaApiError);
  });

  it("throws when credentials are missing", async () => {
    process.env.KUBERA_API_KEY = "";
    process.env.KUBERA_API_SECRET = "";
    const { listPortfolios } = await import("./kubera");
    await expect(listPortfolios()).rejects.toThrow(/KUBERA_API_KEY/);
  });
});
