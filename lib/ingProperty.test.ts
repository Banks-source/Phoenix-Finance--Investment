import { describe, it, expect } from "vitest";
import { applyIngLoanCategory } from "./ingProperty";

const fees = { category: "Fees", sub_category: "Interest charged", type: "bills_fixed" as const };

describe("applyIngLoanCategory", () => {
  it("moves ING interest into Property Interest (ING)", () => {
    const r = applyIngLoanCategory("ING BANK (Australia) Ltd", fees, "INTEREST CHARGED");
    expect(r).toMatchObject({ category: "Property Interest (ING)", sub_category: "Loan Interest", type: "bills_fixed" });
  });
  it("labels fees separately", () => {
    expect(applyIngLoanCategory("ING BANK (Australia) Ltd", fees, "LATE PAYMENT FEE").sub_category).toBe("Loan Fees");
  });
  it("leaves other banks' fees alone", () => {
    expect(applyIngLoanCategory("NAB", fees, "INTEREST CHARGED")).toBe(fees);
  });
  it("leaves non-fee ING rows alone", () => {
    const t = { category: "Money Movement", sub_category: null, type: "transfers" as const };
    expect(applyIngLoanCategory("ING BANK (Australia) Ltd", t, "INTERNAL TRANSFER")).toBe(t);
  });
});
