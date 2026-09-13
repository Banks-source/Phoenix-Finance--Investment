import { describe, it, expect } from "vitest";
import { resolveIncomeSubCategory } from "./incomeClassification";

describe("resolveIncomeSubCategory", () => {
  it("attributes salary to the owning spouse", () => {
    expect(resolveIncomeSubCategory("SALARY70/121680 IAG SERVICES PTY LLOYD THOMAS", "lloyd")).toBe("Lloyd Salary");
    expect(resolveIncomeSubCategory("Salary Myer Pty Ltd 01062182", "milani")).toBe("Milani Salary");
  });

  it("falls back to Other Income for joint/ambiguous salary rows", () => {
    expect(resolveIncomeSubCategory("SALARY something", "joint")).toBe("Other Income");
  });

  it("classifies rent disbursements as Rent", () => {
    expect(resolveIncomeSubCategory("RENT DISBURSEMENT BEYOND PROPERTY", "milani")).toBe("Rent");
  });

  it("classifies ATO refunds and tax office payments as Taxes", () => {
    expect(resolveIncomeSubCategory("J GIUFFRE & CO PTY L ATO REFUND", "lloyd")).toBe("Taxes");
    expect(resolveIncomeSubCategory("INTERNET BPAY TAX OFFICE PAYMENTS", "lloyd")).toBe("Taxes");
  });

  it("falls back to Other Income for everything else (dividends, refunds, interest, deposits)", () => {
    expect(resolveIncomeSubCategory("Direct Credit 629786 TLS FNL DIV 001322290508", "milani")).toBe("Other Income");
    expect(resolveIncomeSubCategory("Afterpay afterpay.com", "lloyd")).toBe("Other Income");
    expect(resolveIncomeSubCategory("CREDIT INTEREST", "milani")).toBe("Other Income");
    expect(resolveIncomeSubCategory(null, "lloyd")).toBe("Other Income");
  });
});
