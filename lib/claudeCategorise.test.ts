import { describe, it, expect } from "vitest";
import { parseBatch, allowedCategories, buildPrompt } from "./claudeCategorise";

const qs = [
  { merchant: "Acme Cafe", detail: "ACME CAFE COOLUM", amount: -12.5 },
  { merchant: null, detail: "REFUND ACME", amount: 30 },
];

describe("parseBatch", () => {
  it("reads the JSON even with fences or chatter around it", () => {
    const text = 'Sure!\n```json\n[{"i":0,"category":"Dining Out","confidence":0.9},{"i":1,"category":"Dining Out","confidence":0.4}]\n```';
    const m = parseBatch(text, qs);
    expect(m.get(0)?.category).toBe("Dining Out");
    expect(m.get(1)?.category).toBe("Dining Out");
  });

  it("caps confidence — it's only ever a suggestion", () => {
    expect(parseBatch('[{"i":0,"category":"Groceries","confidence":1}]', qs).get(0)?.confidence).toBe(0.85);
  });

  it("drops invented categories, transfers, and Income on money out", () => {
    const text = '[{"i":0,"category":"Made Up"},{"i":0,"category":"Money Movement"},{"i":0,"category":"Income"}]';
    expect(parseBatch(text, qs).size).toBe(0);
  });

  it("allows Income on money in", () => {
    expect(parseBatch('[{"i":1,"category":"Income","confidence":0.6}]', qs).get(1)?.category).toBe("Income");
  });

  it("survives garbage", () => {
    expect(parseBatch("no json here", qs).size).toBe(0);
    expect(parseBatch("[{broken", qs).size).toBe(0);
  });
});

describe("prompt", () => {
  it("lists each item and only the allowed categories", () => {
    const p = buildPrompt(qs);
    expect(p).toContain('0. merchant="Acme Cafe"');
    expect(p).toContain("money in");
    expect(allowedCategories(false)).not.toContain("Income");
    expect(allowedCategories(true)).not.toContain("Money Movement");
  });
});
