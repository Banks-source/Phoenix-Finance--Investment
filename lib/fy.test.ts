import { describe, it, expect } from "vitest";
import { fyLabel, fyEndYearForDate, periodLabel, parsePeriod, periodBounds } from "./fy";

describe("fyLabel", () => {
  it("uses the single end-year AU convention, not a two-year range", () => {
    // Regression: this used to render "FY26-27", which read as an unfamiliar
    // format and looked like the current FY was missing from the selector.
    expect(fyLabel(2027)).toBe("FY27");
    expect(fyLabel(2026)).toBe("FY26");
  });

  it("matches the codebase's own documented convention (claimsHistory.ts)", () => {
    // "AU financial years are named by their END year (FY2025 = year ended 30 Jun 2025)"
    expect(fyLabel(2025)).toBe("FY25");
  });
});

describe("fyEndYearForDate + fyLabel", () => {
  it("a date in July 2026 resolves to FY27", () => {
    const fy = fyEndYearForDate("2026-07-15");
    expect(fy).toBe(2027);
    expect(fyLabel(fy)).toBe("FY27");
  });

  it("a date in June 2026 resolves to FY26", () => {
    const fy = fyEndYearForDate("2026-06-15");
    expect(fy).toBe(2026);
    expect(fyLabel(fy)).toBe("FY26");
  });
});

describe("periodLabel", () => {
  it("delegates to fyLabel for fy periods", () => {
    expect(periodLabel({ kind: "fy", value: 2027 })).toBe("FY27");
  });

  it("renders a custom range as 'from – to'", () => {
    expect(periodLabel({ kind: "custom", from: "2026-01-01", to: "2026-03-31" })).toBe("2026-01-01 – 2026-03-31");
  });
});

describe("custom period parsing + bounds", () => {
  it("parses a custom period from period/from/to search params", () => {
    const p = parsePeriod({ period: "custom", from: "2026-01-01", to: "2026-03-31" });
    expect(p).toEqual({ kind: "custom", from: "2026-01-01", to: "2026-03-31" });
  });

  it("falls back to 'all' when period=custom but from/to are missing", () => {
    expect(parsePeriod({ period: "custom" })).toEqual({ kind: "all" });
    expect(parsePeriod({ period: "custom", from: "2026-01-01" })).toEqual({ kind: "all" });
  });

  it("periodBounds returns the exact from/to for a custom period", () => {
    expect(periodBounds({ kind: "custom", from: "2026-01-01", to: "2026-03-31" })).toEqual([
      "2026-01-01",
      "2026-03-31",
    ]);
  });
});
