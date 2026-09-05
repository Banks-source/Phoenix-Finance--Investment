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

  it("still categorises an ATM cash withdrawal as needs_categorisation", () => {
    const result = ruleCategorise("CBA ATM CASH WITHDRAWAL", "");
    expect(result.category).toBe("Money Movement");
    expect(result.sub_category).toBe("Cash Withdrawal");
    expect(result.type).toBe("needs_categorisation");
  });

  it("still categorises a direct-debit (non-BPAY) utility payment as Utilities", () => {
    const result = ruleCategorise("DIRECT DEBIT ORIGIN ENERGY", "ORIGIN ENERGY");
    expect(result.category).toBe("Utilities");
    expect(result.type).toBe("bills_fixed");
  });
});
