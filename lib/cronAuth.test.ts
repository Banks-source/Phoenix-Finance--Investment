import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAuthorizedCronRequest } from "./cronAuth";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function reqWithAuth(header: string | null) {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("https://example.com/api/kubera/sync", { headers });
}

describe("isAuthorizedCronRequest", () => {
  it("rejects when CRON_SECRET is not configured, even with a matching header", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest(reqWithAuth("Bearer anything"))).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isAuthorizedCronRequest(reqWithAuth(null))).toBe(false);
  });

  it("rejects a mismatched token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isAuthorizedCronRequest(reqWithAuth("Bearer wrong"))).toBe(false);
  });

  it("accepts the exact expected bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(isAuthorizedCronRequest(reqWithAuth("Bearer s3cret"))).toBe(true);
  });
});
