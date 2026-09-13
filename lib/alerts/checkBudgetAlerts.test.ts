import { describe, it, expect } from "vitest";
import { findTriggeredAlerts, formatAlertMessage, AlertRule } from "./checkBudgetAlerts";

function rule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "r1",
    category: "Dining Out",
    channel: "email",
    destination: "lloyd@example.com",
    threshold_pct: 100,
    enabled: true,
    ...overrides,
  };
}

describe("findTriggeredAlerts", () => {
  it("triggers when spend reaches the threshold percentage of budget", () => {
    const result = findTriggeredAlerts([rule({ threshold_pct: 80 })], { "Dining Out": 850 }, { "Dining Out": 1000 });
    expect(result).toHaveLength(1);
    expect(result[0].pct).toBeCloseTo(85);
  });

  it("does not trigger below the threshold", () => {
    const result = findTriggeredAlerts([rule({ threshold_pct: 100 })], { "Dining Out": 500 }, { "Dining Out": 1000 });
    expect(result).toHaveLength(0);
  });

  it("skips disabled rules", () => {
    const result = findTriggeredAlerts([rule({ enabled: false })], { "Dining Out": 2000 }, { "Dining Out": 1000 });
    expect(result).toHaveLength(0);
  });

  it("skips a category with no budget set rather than guessing", () => {
    const result = findTriggeredAlerts([rule({ category: "Groceries" })], { Groceries: 500 }, {});
    expect(result).toHaveLength(0);
  });

  it("treats a category with no spend yet as 0", () => {
    const result = findTriggeredAlerts([rule({ threshold_pct: 1 })], {}, { "Dining Out": 1000 });
    expect(result).toHaveLength(0);
  });
});

describe("formatAlertMessage", () => {
  it("includes the category, amounts, and rounded percentage", () => {
    const msg = formatAlertMessage({ rule: rule(), spent: 850, budget: 1000, pct: 85 });
    expect(msg.subject).toContain("Dining Out");
    expect(msg.subject).toContain("85%");
    expect(msg.body).toContain("$850.00");
    expect(msg.body).toContain("$1000.00");
  });
});
