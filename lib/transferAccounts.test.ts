import { describe, it, expect } from "vitest";
import { resolveFromTo, findCounterpartAccount, AccountRef } from "./transferAccounts";

const A: AccountRef[] = [
  { id: "a1", institution: "CommBank", account_label: "Smart Access", account_number_masked: "xxxx5288" },
  { id: "a2", institution: "CommBank", account_label: "NetBank Saver", account_number_masked: "xxxx2697" },
  { id: "a3", institution: "NAB", account_label: "NAB Everyday - 891388212", account_number_masked: null },
];

describe("resolveFromTo", () => {
  it("finds the destination named in a debit transfer", () => {
    const r = resolveFromTo({ account_id: "a2", detail: "Transfer to xx5288 CommBank app", amount: -217 }, A);
    expect(r).toEqual({ from: "CommBank NetBank Saver", to: "CommBank Smart Access", internal: true });
  });
  it("finds the source of a credit transfer", () => {
    const r = resolveFromTo({ account_id: "a1", detail: "Transfer from xx2697 CommBank app", amount: 217 }, A);
    expect(r).toEqual({ from: "CommBank NetBank Saver", to: "CommBank Smart Access", internal: true });
  });
  it("uses the paired-reference account when the text names nothing", () => {
    const r = resolveFromTo({ account_id: "a1", detail: "Some transfer", amount: -50 }, A, "a3");
    expect(r.to).toBe("NAB Everyday - 891388212");
  });
  it("leaves the other side null for ordinary spending", () => {
    const r = resolveFromTo({ account_id: "a1", detail: "WEBCENTRAL MELBOURNE", amount: -14.95 }, A);
    expect(r).toEqual({ from: "CommBank Smart Access", to: null, internal: false });
  });
  it("does not match digits embedded in a longer number", () => {
    expect(findCounterpartAccount("ZIPMONEY* P8882697411", "a1", A)).toBeNull();
  });
});
