import { describe, it, expect } from "vitest";
import { computeAnnualPace, yearFraction } from "./annualBudget";

describe("yearFraction", () => {
  it("is 1 for a past year and 0 for a future one", () => {
    expect(yearFraction(2025, new Date(2026, 8, 19))).toBe(1);
    expect(yearFraction(2027, new Date(2026, 8, 19))).toBe(0);
  });

  it("is roughly the elapsed share of the current year", () => {
    // 1 July 2026 -> 182 days elapsed (Jan 1 .. Jul 1 inclusive) of 365
    expect(yearFraction(2026, new Date(2026, 6, 1))).toBeCloseTo(182 / 365, 3);
  });
});

describe("computeAnnualPace", () => {
  it("reads as on target when spend tracks the expected pace", () => {
    // $18,333/mo -> ~$220K a year; half-way through the year with ~$110K spent
    const pace = computeAnnualPace(18_333.33, 110_000, 0.5);
    expect(pace.annualBudget).toBeCloseTo(220_000, 0);
    expect(pace.status).toBe("on_target");
    expect(pace.projected).toBeCloseTo(220_000, 0);
  });

  it("flags spending running ahead of pace", () => {
    const pace = computeAnnualPace(10_000, 75_000, 0.5); // expected 60,000
    expect(pace.status).toBe("over");
    expect(pace.deviationPct).toBeCloseTo(25, 5);
  });

  it("flags spending running behind pace", () => {
    const pace = computeAnnualPace(10_000, 45_000, 0.5);
    expect(pace.status).toBe("under");
    expect(pace.deviationPct).toBeCloseTo(-25, 5);
  });

  it("doesn't divide by zero before the year starts", () => {
    const pace = computeAnnualPace(10_000, 0, 0);
    expect(pace.status).toBe("on_target");
    expect(pace.projected).toBe(0);
  });
});
