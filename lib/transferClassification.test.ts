import { describe, it, expect } from "vitest";
import {
  classifyMoneyMovement,
  deriveMoneyMovementSubCategory,
  extractAccountDigits,
  needsBufferDecision,
} from "./transferClassification";

describe("needsBufferDecision", () => {
  it("flags a large Westpac buffer move for an explicit paydown-vs-transfer call", () => {
    expect(needsBufferDecision("lloyd thomas D5510078021 WESTPAC PAYMENT", -25000)).toBe(true);
    expect(needsBufferDecision("C57334 TFR FROM Westpa c Choice", 25000)).toBe(true);
  });

  it("leaves small everyday buffer movements as internal transfers", () => {
    expect(needsBufferDecision("lloyd thomas H7169196683 WESTPAC PAYMENT", -1999.99)).toBe(false);
  });

  it("ignores large transfers that have nothing to do with Westpac", () => {
    expect(needsBufferDecision("Transfer to xx2697 CommBank app", -5000)).toBe(false);
  });
});

const OUR_DIGITS = extractAccountDigits("CAB - 2697", "CAB - 5288", "xxxx8212", "xxxx0140", "xxxx8814", "xxxx0982");

describe("classifyMoneyMovement", () => {
  it("classifies transfers between our own masked account numbers as internal", () => {
    expect(classifyMoneyMovement("Transfer to xx2697 CommBank app", OUR_DIGITS)).toBe("Internal transfer");
    expect(classifyMoneyMovement("Transfer from xx5288 CommBank app", OUR_DIGITS)).toBe("Internal transfer");
  });

  it("classifies transfers naming an account holder (even truncated) as internal", () => {
    expect(classifyMoneyMovement("Fast Transfer From MRS MILANI BIANCA SIM, CREDIT TO ACCOUNT", OUR_DIGITS)).toBe(
      "Internal transfer"
    );
    expect(classifyMoneyMovement("Transfer to LLOYD THOMAS, NetBank", OUR_DIGITS)).toBe("Internal transfer");
  });

  it("classifies a named third-party payee as an external transfer", () => {
    expect(classifyMoneyMovement("Transfer To JULIE CUPPLES, PayID Phone from CommBank App, Dog grooming", OUR_DIGITS)).toBe(
      "External transfer"
    );
    expect(classifyMoneyMovement("Transfer To marquetta thomas, CommBank App Mike", OUR_DIGITS)).toBe(
      "External transfer"
    );
  });

  it("leaves ambiguous bank-nickname transfers unclassified rather than guessing", () => {
    expect(classifyMoneyMovement("Transfer To Banks NAB, CommBank App Bills", OUR_DIGITS)).toBeNull();
  });

  it("leaves single-word institution payouts unclassified rather than guessing", () => {
    expect(classifyMoneyMovement("Fast Transfer From Swyftx, CT.20gq8l AUD Payout", OUR_DIGITS)).toBeNull();
  });

  it("leaves bare BPAY/PAYID codes with no name unclassified", () => {
    expect(classifyMoneyMovement("BPAY Payment 123456", OUR_DIGITS)).toBeNull();
    expect(classifyMoneyMovement(null, OUR_DIGITS)).toBeNull();
  });

  it("classifies NAB's bare 'Name <reference code>' linked-account style", () => {
    expect(classifyMoneyMovement("MILANI SIMIC Z5960682958", OUR_DIGITS)).toBe("Internal transfer");
    expect(classifyMoneyMovement("Susan Thomas N4545136827 PAYMENT", OUR_DIGITS)).toBe("External transfer");
    expect(classifyMoneyMovement("Marquetta Manokaran A1385319327", OUR_DIGITS)).toBe("External transfer");
  });
});

describe("deriveMoneyMovementSubCategory", () => {
  it("prefers the internal/external direction when determinable", () => {
    expect(deriveMoneyMovementSubCategory("Transfer to xx2697 CommBank app", null, OUR_DIGITS)).toBe("Internal transfer");
  });

  it("classifies cash withdrawals, ZipMoney, Centrelink, and generic card/bill payments", () => {
    expect(deriveMoneyMovementSubCategory("CBA ATM CASH WITHDRAWAL", null, OUR_DIGITS)).toBe("Cash Withdrawal");
    // Bare "WITHDRAWAL" is a Westpac buffer move, not cash
    expect(deriveMoneyMovementSubCategory("WITHDRAWAL", "WITHDRAWAL", OUR_DIGITS)).toBe("Internal transfer");
    expect(deriveMoneyMovementSubCategory("ZIPMONEY* P888147211 SYDNEY NS", null, OUR_DIGITS)).toBe("ZipMoney");
    expect(deriveMoneyMovementSubCategory("Centrelink payment", null, OUR_DIGITS)).toBe("Centrelink");
    expect(deriveMoneyMovementSubCategory("INTERNET PAYMENT Linked Acc Trns", null, OUR_DIGITS)).toBe("Card payment");
  });

  it("falls back to Needs review rather than guessing", () => {
    expect(deriveMoneyMovementSubCategory("Fast Transfer From Swyftx, CT.20gq8l AUD Payout", null, OUR_DIGITS)).toBe(
      "Needs review"
    );
  });
});

describe("extractAccountDigits", () => {
  it("extracts full digit runs and their trailing 4 digits", () => {
    expect(extractAccountDigits("NAB 891388212")).toEqual(expect.arrayContaining(["891388212", "8212"]));
  });

  it("ignores null/undefined values", () => {
    expect(extractAccountDigits(null, undefined, "CAB - 2697")).toEqual(["2697"]);
  });
});
