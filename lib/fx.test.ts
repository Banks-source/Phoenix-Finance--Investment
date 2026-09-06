import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

function mockRates(rates: Record<string, number>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "success", rates }),
    })
  );
}

describe("convert", () => {
  it("returns the amount unchanged when from === to, without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { convert } = await import("./fx");
    expect(await convert(100, "AUD", "AUD")).toBe(100);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converts using USD-based rates", async () => {
    mockRates({ USD: 1, AUD: 1.5, EUR: 0.9 });
    const { convert } = await import("./fx");
    // 150 AUD -> 100 USD -> 90 EUR
    expect(await convert(150, "AUD", "EUR")).toBeCloseTo(90, 6);
  });

  it("caches rates across calls (single fetch for two conversions)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "success", rates: { USD: 1, AUD: 1.5 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { convert } = await import("./fx");
    await convert(100, "USD", "AUD");
    await convert(100, "USD", "AUD");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when a currency has no rate", async () => {
    mockRates({ USD: 1, AUD: 1.5 });
    const { convert } = await import("./fx");
    await expect(convert(100, "AUD", "XYZ")).rejects.toThrow(/No FX rate/);
  });

  it("throws when the provider response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { convert } = await import("./fx");
    await expect(convert(100, "AUD", "USD")).rejects.toThrow(/FX rate fetch failed/);
  });
});
