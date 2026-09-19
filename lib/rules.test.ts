import { describe, it, expect } from "vitest";
import { ruleCategorise } from "./rules";

describe("ruleCategorise — bill payments made via BPAY/transfer", () => {
  it("categorises a BPAY payment to a recognised biller as the real bill category, not Money Movement", () => {
    // Regression test: this used to match the generic BPAY rule (checked
    // early in the array) before ever reaching the AGL/Utilities rule,
    // locking real bill payments into Money Movement/transfers.
    const result = ruleCategorise("BPAY PAYMENT AGL ENERGY REF 12345", "AGL ENERGY");
    expect(result.category).toBe("Utilities");
    expect(result.type).toBe("bills_fixed");
  });

  it("categorises a BPAY payment to Telstra as Utilities", () => {
    const result = ruleCategorise("BPAY TELSTRA CORP", "TELSTRA");
    expect(result.category).toBe("Utilities");
    expect(result.type).toBe("bills_fixed");
  });

  it("still falls through to Money Movement for a BPAY payment with no recognised biller", () => {
    const result = ruleCategorise("BPAY PAYMENT REF 99887766", "UNKNOWN BILLER");
    expect(result.category).toBe("Money Movement");
    expect(result.type).toBe("transfers");
  });

  it("still categorises a generic 'Transfer to' with no recognised payee as Money Movement", () => {
    const result = ruleCategorise("TRANSFER TO XX1234", "");
    expect(result.category).toBe("Money Movement");
    expect(result.type).toBe("transfers");
  });

  it("still recognises a named-person transfer as an internal transfer (unambiguous, checked early)", () => {
    const result = ruleCategorise("TRANSFER TO LLOYD THOMAS", "LLOYD THOMAS");
    expect(result.category).toBe("Money Movement");
    expect(result.sub_category).toBe("Internal transfer");
    expect(result.type).toBe("transfers");
  });

  it("categorises an ATM cash withdrawal as its own Cash Withdrawal expense category", () => {
    const result = ruleCategorise("CBA ATM CASH WITHDRAWAL", "");
    expect(result.category).toBe("Cash Withdrawal");
    expect(result.type).toBe("spending");
  });

  it("still categorises a direct-debit (non-BPAY) utility payment as Utilities", () => {
    const result = ruleCategorise("DIRECT DEBIT ORIGIN ENERGY", "ORIGIN ENERGY");
    expect(result.category).toBe("Utilities");
    expect(result.type).toBe("bills_fixed");
  });
});

describe("ruleCategorise — loan/redraw buffer transfers vs the interest they fund", () => {
  it("categorises an Ashby investment-loan transfer as Investment/transfers, not debt (interest is the real cost, tracked separately)", () => {
    const result = ruleCategorise("Transfer To milani CommBank App Ashby loan", "");
    expect(result.category).toBe("Investment");
    expect(result.sub_category).toBe("Ashby Loan");
    expect(result.type).toBe("transfers");
  });

  it("categorises a Westpac Flexi Loan buffer payment as Money Movement/transfers, not debt", () => {
    const result = ruleCategorise("lloyd thomas D5510078021 WESTPAC PAYMENT", "");
    expect(result.category).toBe("Money Movement");
    expect(result.sub_category).toBe("Internal transfer");
    expect(result.type).toBe("transfers");
  });

  it("categorises the Westpac Flexi Loan account's own inbound/outbound buffer legs as Money Movement", () => {
    expect(ruleCategorise("TFR FROM Westpa c Choice", "").category).toBe("Money Movement");
    expect(ruleCategorise("WITHDRAWAL", "WITHDRAWAL").category).toBe("Money Movement");
  });

  it("categorises a Rudy transfer as Family Assistance, a real recurring expense (not a debt repayment)", () => {
    const result = ruleCategorise("RUDY M7844318631", "");
    expect(result.category).toBe("Family Assistance");
    expect(result.type).toBe("bills_fixed");
  });

  it("counts the Ashby loan's interest charge as a Fees expense, unlike the principal transfer", () => {
    const result = ruleCategorise("Interest Charge — Ashby INV loan 200411638", "");
    expect(result.category).toBe("Fees");
    expect(result.sub_category).toBe("Ashby Loan Interest");
    expect(result.type).toBe("bills_fixed");
  });

  it("counts an ING loan late payment fee as a Fees expense", () => {
    const result = ruleCategorise("ING loan late payment fee", "");
    expect(result.category).toBe("Fees");
    expect(result.sub_category).toBe("Ashby Loan Fees");
    expect(result.type).toBe("bills_fixed");
  });
});

describe("ruleCategorise — ING loan account lines", () => {
  it("treats ING internal transfers as Money Movement/transfers", () => {
    for (const d of ["INTERNAL TRANSFER 923100 31083941", "INTERNAL TRANSFER TO LINKED ING ACCOUNT 923100 200411638"]) {
      const r = ruleCategorise(d, "");
      expect(r.category).toBe("Money Movement");
      expect(r.type).toBe("transfers");
    }
  });

  it("treats a bare late payment fee as a Fees expense", () => {
    const r = ruleCategorise("LATE PAYMENT FEE", "");
    expect(r.category).toBe("Fees");
    expect(r.type).toBe("bills_fixed");
  });
});
