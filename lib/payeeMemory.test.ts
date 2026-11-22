import { describe, it, expect } from "vitest";
import { ruleCandidates, seedFromHistory } from "./payeeMemory";
import { matchRule, categoriseSync, MerchantRule } from "./categorise";

const row = (merchant: string, detail: string, category: string | null, sub_category: string | null = null) => ({
  merchant,
  detail,
  category,
  sub_category,
});

describe("ruleCandidates", () => {
  it("keys the rule on the payee, not the raw text", () => {
    const r = ruleCandidates([row("Coles", "COLES 4420 COOLUM BEACH", "Groceries", "Coles")], "user");
    expect(r).toEqual([expect.objectContaining({ key: "COLES", category: "Groceries", sub_category: "Coles" })]);
  });

  it("takes the most common answer when one payee is categorised both ways in a batch", () => {
    const r = ruleCandidates(
      [row("Coles", "COLES 1", "Groceries"), row("Coles", "COLES 2", "Groceries"), row("Coles", "COLES 3", "Shopping")],
      "user"
    );
    expect(r[0].category).toBe("Groceries");
  });

  it("does not learn Uncategorised, and does not learn transfers from a mere approval", () => {
    expect(ruleCandidates([row("Foo Bar", "FOO BAR", "Uncategorised")], "user")).toEqual([]);
    expect(ruleCandidates([row("Foo Bar", "FOO BAR", "Money Movement")], "confirmed")).toEqual([]);
    expect(ruleCandidates([row("Foo Bar", "FOO BAR", "Money Movement")], "user")).toHaveLength(1);
  });
});

describe("seedFromHistory", () => {
  it("needs a payee seen twice and mostly the same answer", () => {
    const seeds = seedFromHistory([
      row("Alley Cat", "SQ *ALLEY CAT ABN 9417 Coolum Beach", "Dining Out", "Cafe & Coffee"),
      row("Alley Cat", "SQ *ALLEY CAT ABN 9417 Coolum Beach", "Dining Out", "Cafe & Coffee"),
      row("One Off", "ONE OFF SHOP", "Shopping"),
      row("Mixed Co", "MIXED CO 1", "Shopping"),
      row("Mixed Co", "MIXED CO 2", "Health"),
    ]);
    expect(seeds.map((s) => s.key)).toEqual(["ALLEY CAT"]);
    expect(seeds[0].sub_category).toBe("Cafe & Coffee");
  });

  it("leaves income and transfers to their own logic", () => {
    const seeds = seedFromHistory([row("Acme", "ACME PAY", "Income"), row("Acme", "ACME PAY", "Income")]);
    expect(seeds).toEqual([]);
  });
});

describe("matchRule with payee keys", () => {
  const rules: MerchantRule[] = [
    { merchant_pattern: "COLES", category: "Groceries", sub_category: "Coles", type: "spending", match_count: 3, source: "user" },
    { merchant_pattern: "ALLEY CAT", category: "Dining Out", sub_category: "Cafe & Coffee", type: "spending", match_count: 2, source: "history" },
  ];

  it("hits the same rule whatever the store number, suburb or card tail", () => {
    expect(matchRule("Coles 8758 Peregian Sprs Ql Aus", rules, "COLES 8758 PEREGIAN SPRS QL AUS, Card xx1075, Value date: 15/10/2026")?.category).toBe(
      "Groceries"
    );
    expect(matchRule("COLES 4420 COOLUM BEACH", rules)?.category).toBe("Groceries");
  });

  it("lets your own rule beat the built-in keyword rules, but not a mere inference", () => {
    const userWins = categoriseSync("Woolworths", "WOOLWORTHS 1234", [
      { merchant_pattern: "WOOLWORTHS", category: "Kids", sub_category: "Other", type: "spending", match_count: 1, source: "user" },
    ]);
    expect(userWins.category).toBe("Kids");

    const historyLoses = categoriseSync("Woolworths", "WOOLWORTHS 1234", [
      { merchant_pattern: "WOOLWORTHS", category: "Kids", sub_category: "Other", type: "spending", match_count: 1, source: "history" },
    ]);
    expect(historyLoses.category).toBe("Groceries");
  });

  it("uses a history rule when nothing else matches", () => {
    expect(categoriseSync("Alley Cat", "SQ *ALLEY CAT ABN 9417", rules).category).toBe("Dining Out");
  });
});
