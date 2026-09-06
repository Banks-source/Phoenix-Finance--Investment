import { describe, it, expect } from "vitest";
import { projectForwardValues, ProjectionInput } from "./projections";

const baseInput: ProjectionInput = {
  currentAge: 45,
  targetAges: [65, 75, 85],
  groupSleeveBalances: {
    personal: { btc_crypto: 100000 },
    retirement: { btc_crypto: 200000 },
  },
  groupOtherAssetsAud: { personal: 0, retirement: 0 },
  sleeveGrowthRatesPct: { btc_crypto: 8 },
  otherAssetsGrowthPct: 3,
  monthlyContributions: { personal: 0, retirement: 0 },
  sleeveWeights: { btc_crypto: 1 },
};

describe("projectForwardValues", () => {
  it("computes yearsOut correctly for each target age", () => {
    const points = projectForwardValues(baseInput);
    expect(points.map((p) => p.yearsOut)).toEqual([20, 30, 40]);
  });

  it("compounds a lump sum with no contributions using standard compound interest", () => {
    const points = projectForwardValues({ ...baseInput, monthlyContributions: { personal: 0, retirement: 0 } });
    const at65 = points[0];
    // 100000 * (1 + 0.08/12)^(20*12)
    const expectedPersonal = 100000 * Math.pow(1 + 0.08 / 12, 240);
    expect(at65.personalAud).toBeCloseTo(expectedPersonal, 2);
  });

  it("adds the future value of monthly contributions on top of the lump sum", () => {
    const withContributions = projectForwardValues({
      ...baseInput,
      monthlyContributions: { personal: 500, retirement: 0 },
    });
    const withoutContributions = projectForwardValues(baseInput);
    expect(withContributions[0].personalAud).toBeGreaterThan(withoutContributions[0].personalAud);
  });

  it("returns the present value unchanged when the target age has already passed", () => {
    const points = projectForwardValues({ ...baseInput, currentAge: 70 }); // 65 is in the past
    const at65 = points[0];
    expect(at65.yearsOut).toBe(-5);
    expect(at65.personalAud).toBe(100000);
  });

  it("compounds otherAssetsAud at its own rate, unaffected by sleeve rates", () => {
    const points = projectForwardValues({
      ...baseInput,
      groupSleeveBalances: { personal: {}, retirement: {} },
      groupOtherAssetsAud: { personal: 50000, retirement: 0 },
      sleeveWeights: {},
      otherAssetsGrowthPct: 5,
    });
    const expected = 50000 * Math.pow(1 + 0.05 / 12, 240);
    expect(points[0].personalAud).toBeCloseTo(expected, 2);
  });

  it("falls back to putting new contributions in dry_powder when no sleeve weights are set", () => {
    const points = projectForwardValues({
      ...baseInput,
      groupSleeveBalances: { personal: {}, retirement: {} },
      sleeveGrowthRatesPct: { dry_powder: 2 },
      sleeveWeights: {},
      monthlyContributions: { personal: 1000, retirement: 0 },
    });
    // 1000/mo for 240 months at 2%/yr should produce a real, positive value
    expect(points[0].personalAud).toBeGreaterThan(1000 * 240 * 0.9); // sanity: more than raw contributions minus a margin
  });

  it("combinedAud is always personal + retirement", () => {
    const points = projectForwardValues(baseInput);
    for (const p of points) {
      expect(p.combinedAud).toBeCloseTo(p.personalAud + p.retirementAud, 6);
    }
  });
});
