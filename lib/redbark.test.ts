import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, REDBARK_API_KEY: "rbk_live_test", REDBARK_API_VERSION: "2026-10-01.wattle" };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("listConnections / listAccounts / listTransactions", () => {
  it("sends the required auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ object: "list", data: [], next_page_url: null, previous_page_url: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listConnections } = await import("./redbark");
    await listConnections();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/api\.redbark\.com\/v2\/connections\?/);
    expect(init.headers.Authorization).toBe("Bearer rbk_live_test");
    expect(init.headers["Redbark-Version"]).toBe("2026-10-01.wattle");
  });

  it("follows next_page_url until it is null", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          object: "list",
          data: [{ id: "conn_1" }],
          next_page_url: "https://api.redbark.com/v2/connections?page=tok_abc",
          previous_page_url: null,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ object: "list", data: [{ id: "conn_2" }], next_page_url: null, previous_page_url: null })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { listConnections } = await import("./redbark");
    const result = await listConnections();

    expect(result).toEqual([{ id: "conn_1" }, { id: "conn_2" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain("page=tok_abc");
  });

  it("filters accounts by connection id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ object: "list", data: [], next_page_url: null, previous_page_url: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listAccounts } = await import("./redbark");
    await listAccounts("conn_123");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("connection=conn_123");
  });

  it("passes from/to/include_pending through to the transactions request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ object: "list", data: [], next_page_url: null, previous_page_url: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listTransactions } = await import("./redbark");
    await listTransactions("acct_1", { from: "2026-01-01", to: "2026-02-01", includePending: true });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("account=acct_1");
    expect(url).toContain("from=2026-01-01");
    expect(url).toContain("to=2026-02-01");
    expect(url).toContain("include_pending=true");
  });

  it("omits include_pending when not requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ object: "list", data: [], next_page_url: null, previous_page_url: null })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listTransactions } = await import("./redbark");
    await listTransactions("acct_1", {});

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("include_pending");
  });

  it("throws RedbarkApiError on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { message: "bad token", code: "authentication_error" } }, false, 401)
      )
    );
    const { listConnections, RedbarkApiError } = await import("./redbark");
    await expect(listConnections()).rejects.toThrow(RedbarkApiError);
  });

  it("throws when credentials are missing", async () => {
    process.env.REDBARK_API_KEY = "";
    const { listConnections } = await import("./redbark");
    await expect(listConnections()).rejects.toThrow(/REDBARK_API_KEY/);
  });
});
