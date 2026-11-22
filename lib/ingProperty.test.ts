import { describe, it, expect } from "vitest";
import { applyIngLoanCategory } from "./ingProperty";

const fees = { category: "Fees", sub_category: "Interest charged", type: "bills_fixed" as const };

describe("applyIngLoanCategory", () => {
  it("moves ING interest into Investment", () => {
    const r = applyIngLoanCategory("ING BANK (Australia) Ltd", "ING Australia Residential Mortgage", fees, "INTEREST CHARGED");
    expect(r).toMatchObject({ category: "Investment", sub_category: "Loan Interest", type: "bills_fixed" });
  });
  it("labels fees separately", () => {
    expect(applyIngLoanCategory("ING BANK (Australia) Ltd", "ING Australia Residential Mortgage", fees, "LATE PAYMENT FEE").sub_category).toBe("Loan Fees");
  });
  it("leaves other banks' fees alone", () => {
    expect(applyIngLoanCategory("NAB", "Everyday", fees, "INTEREST CHARGED")).toBe(fees);
  });
  it("leaves fees on other ING accounts alone", () => {
    expect(applyIngLoanCategory("ING BANK (Australia) Ltd", "ING Australia Orange Everyday", fees, "ACCOUNT FEE")).toBe(fees);
  });
  it("leaves non-fee ING rows alone", () => {
    const t = { category: "Money Movement", sub_category: null, type: "transfers" as const };
    expect(applyIngLoanCategory("ING BANK (Australia) Ltd", "ING Australia Residential Mortgage", t, "INTERNAL TRANSFER")).toBe(t);
  });
});
