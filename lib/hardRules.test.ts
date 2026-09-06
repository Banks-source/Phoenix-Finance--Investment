import { describe, it, expect } from "vitest";
import {
  evaluateRule1NoCoInvestedIlliquid,
  evaluateRule2Concentration,
  evaluateRule3Leverage,
  evaluateRule4LiquidityFloor,
  evaluateRule5BtcSaleCheck,
} from "./hardRules";

describe("evaluateRule1NoCoInvestedIlliquid", () => {
  it("passes when there are no legacy positions", () => {
    expect(evaluateRule1NoCoInvestedIlliquid([]).status).toBe("pass");
  });

  it("passes when the only rule-1 breach has a decision made", () => {
    const r = evaluateRule1NoCoInvestedIlliquid([{ name: "Biofuels", breachedRule: 1, decision: "hold" }]);
    expect(r.status).toBe("pass");
  });

  it("fails when a rule-1 breach has no decision yet", () => {
    const r = evaluateRule1NoCoInvestedIlliquid([{ name: "Biofuels", breachedRule: 1, decision: null }]);
    expect(r.status).toBe("fail");
    expect(r.reason).toContain("Biofuels");
  });

  it("ignores legacy positions flagged against a different rule", () => {
    const r = evaluateRule1NoCoInvestedIlliquid([{ name: "Something else", breachedRule: 3, decision: null }]);
    expect(r.status).toBe("pass");
  });
});

describe("evaluateRule2Concentration", () => {
  it("is not_assessable when net worth is zero", () => {
    expect(evaluateRule2Concentration([], 0, 0).status).toBe("not_assessable");
  });

  it("fails when BTC exceeds 40% of total net worth", () => {
    const assets = [{ name: "Bitcoin", ticker: "BTC", amountAud: 500 }];
    const r = evaluateRule2Concentration(assets, 1000, 1000); // 50% of NW
    expect(r.status).toBe("fail");
    expect(r.reason).toContain("BTC");
  });

  it("identifies BTC by name even when the ticker is not BTC (wallet-aggregation case)", () => {
    const assets = [{ name: "Trezor - Bitcoin Wallet", ticker: "AUD", amountAud: 500 }];
    const r = evaluateRule2Concentration(assets, 1000, 1000);
    expect(r.status).toBe("fail");
  });

  it("passes when BTC is within 40% of NW and no other asset exceeds 15% of investable", () => {
    const assets = [
      { name: "Bitcoin", ticker: "BTC", amountAud: 350 },
      { name: "Goodman Group", ticker: "AUD", amountAud: 100 },
    ];
    const r = evaluateRule2Concentration(assets, 1000, 1000); // BTC 35%, Goodman 10%
    expect(r.status).toBe("pass");
  });

  it("fails when a non-BTC single asset exceeds 15% of investable net worth", () => {
    const assets = [{ name: "Apple Inc", ticker: "AUD", amountAud: 200 }];
    const r = evaluateRule2Concentration(assets, 1000, 1000); // 20% of investable
    expect(r.status).toBe("fail");
    expect(r.reason).toContain("Apple Inc");
  });

  it("uses editable thresholds instead of the hardcoded defaults when given", () => {
    const assets = [{ name: "Bitcoin", ticker: "BTC", amountAud: 450 }]; // 45% of NW
    // Fails against the default 40% limit...
    expect(evaluateRule2Concentration(assets, 1000, 1000).status).toBe("fail");
    // ...but passes against a custom, more permissive 50% limit.
    const custom = evaluateRule2Concentration(assets, 1000, 1000, { btcPctOfNwMax: 50, singleAssetPctMax: 15 });
    expect(custom.status).toBe("pass");
    expect(custom.name).toContain("50%");
  });
});

describe("evaluateRule3Leverage", () => {
  it("passes when there are no active (non-zero) liabilities", () => {
    const r = evaluateRule3Leverage([{ name: "Old Loan", amountAud: 0 }], []);
    expect(r.status).toBe("pass");
  });

  it("fails when LVR against the matched property exceeds 30%", () => {
    const debts = [{ name: "18 Ashby Crt - ING", amountAud: 576029.05 }];
    const properties = [{ name: "Ashby Crt", amountAud: 740000 }];
    const r = evaluateRule3Leverage(debts, properties); // LVR ~77.8%
    expect(r.status).toBe("fail");
    expect(r.reason).toContain("Ashby Crt");
  });

  it("passes when LVR against the matched property is within 30%", () => {
    const debts = [{ name: "18 Ashby Crt - ING", amountAud: 200000 }];
    const properties = [{ name: "Ashby Crt", amountAud: 740000 }]; // ~27%
    const r = evaluateRule3Leverage(debts, properties);
    expect(r.status).toBe("pass");
  });

  it("fails an unmatched liability (e.g. a personal loan or credit card) rather than skipping it", () => {
    const debts = [{ name: "Westpac - Flexi Loan", amountAud: 53951.91 }];
    const r = evaluateRule3Leverage(debts, []);
    expect(r.status).toBe("fail");
    expect(r.reason).toContain("Westpac");
  });

  it("uses an editable LVR limit instead of the hardcoded default", () => {
    const debts = [{ name: "18 Ashby Crt - ING", amountAud: 300000 }];
    const properties = [{ name: "Ashby Crt", amountAud: 740000 }]; // ~40.5% LVR
    expect(evaluateRule3Leverage(debts, properties).status).toBe("fail"); // over default 30%
    const custom = evaluateRule3Leverage(debts, properties, 50);
    expect(custom.status).toBe("pass"); // under a custom 50% limit
    expect(custom.name).toContain("50%");
  });
});

describe("evaluateRule4LiquidityFloor", () => {
  it("is not_assessable when there's no spend data", () => {
    expect(evaluateRule4LiquidityFloor(10000, 0).status).toBe("not_assessable");
  });

  it("passes when dry powder covers 3x average monthly spend", () => {
    const r = evaluateRule4LiquidityFloor(30000, 5000); // floor = 15000
    expect(r.status).toBe("pass");
  });

  it("fails when dry powder is short of the floor", () => {
    const r = evaluateRule4LiquidityFloor(10000, 5000); // floor = 15000
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/short of the \$15000/i);
  });

  it("uses an editable number of months instead of the hardcoded default", () => {
    expect(evaluateRule4LiquidityFloor(10000, 5000).status).toBe("fail"); // default 3mo floor = 15000
    const custom = evaluateRule4LiquidityFloor(10000, 5000, 1); // 1mo floor = 5000
    expect(custom.status).toBe("pass");
    expect(custom.name).toContain("1 months");
  });
});

describe("evaluateRule5BtcSaleCheck", () => {
  it("is not_assessable with fewer than 2 snapshots", () => {
    expect(evaluateRule5BtcSaleCheck([]).status).toBe("not_assessable");
    expect(evaluateRule5BtcSaleCheck([{ syncedAt: "2026-09-01", quantity: 1 }]).status).toBe("not_assessable");
  });

  it("fails when BTC quantity decreased between the two most recent snapshots", () => {
    const r = evaluateRule5BtcSaleCheck([
      { syncedAt: "2026-09-01", quantity: 2 },
      { syncedAt: "2026-09-02", quantity: 1.5 },
    ]);
    expect(r.status).toBe("fail");
  });

  it("passes when BTC quantity held steady or increased", () => {
    const r = evaluateRule5BtcSaleCheck([
      { syncedAt: "2026-09-01", quantity: 1.5 },
      { syncedAt: "2026-09-02", quantity: 1.5 },
    ]);
    expect(r.status).toBe("pass");
  });

  it("sorts by syncedAt rather than trusting input order", () => {
    const r = evaluateRule5BtcSaleCheck([
      { syncedAt: "2026-09-02", quantity: 1 }, // out of order
      { syncedAt: "2026-09-01", quantity: 2 },
    ]);
    expect(r.status).toBe("fail"); // 2 -> 1 chronologically
  });
});
