import { describe, it, expect } from "vitest";
import { payeeKey, candidateKeys } from "./payeeKey";

describe("payeeKey", () => {
  it("ignores store numbers, suburbs' state codes and the card/value-date tail", () => {
    expect(payeeKey("Coles", "COLES 4420 COOLUM BEACH")).toBe("COLES");
    expect(payeeKey("Coles 8758 Peregian Sprs Ql Aus", "COLES 8758 PEREGIAN SPRS QL AUS, Card xx1075, Value date: 15/10/2026")).toBe(
      "COLES PEREGIAN"
    );
    expect(payeeKey(null, "WOOLWORTHS 2617 COOLUM BEACH QL AUS Card xx1075 Value Date: 15/08/2025")).toBe("WOOLWORTHS COOLUM");
  });

  it("uses the clean merchant name when the bank supplies one", () => {
    expect(payeeKey("Amazon", "AMAZON AU MARKETPLACE SYDNEY AUS Card xx1075 Value Date: 21/09/2025")).toBe("AMAZON");
    expect(payeeKey("Coles (Coolum Village)", "COLES 4420 COOLUM BEACH")).toBe("COLES");
  });

  it("strips payment-processor prefixes and punctuation", () => {
    expect(payeeKey(null, "SQ *ALLEY CAT ABN 9417 Coolum Beach")).toBe("ALLEY CAT");
    expect(payeeKey(null, "ZLR*Espresso Bar Intern Maroochydore")).toBe("ESPRESSO BAR");
    expect(payeeKey(null, "POTTER S PANTRY CAFE TEWANTIN")).toBe("POTTER PANTRY");
  });

  it("keys transfers on direction and counterparty, not the memo", () => {
    expect(payeeKey(null, "Transfer To R LEE, PayID Phone from CommBank App, Brunch x")).toBe("TRANSFER TO R LEE");
    expect(payeeKey(null, "Transfer To R LEE PayID Phone from CommBank App MOS TIX")).toBe("TRANSFER TO R LEE");
    expect(payeeKey(null, "Transfer from xx5288 CommBank app")).toBe("TRANSFER FROM XX5288");
    expect(payeeKey(null, "Fast Transfer From MRS MILANI BIANCA SIM CREDIT TO ACCOUNT")).toBe("TRANSFER FROM MILANI BIANCA");
  });

  it("gives the same key whatever the reference numbers", () => {
    const a = payeeKey("ONLINE W Linked Acc Trns THOMAS L", "ONLINE W9297057730 Linked Acc Trns THOMAS L");
    const b = payeeKey("ONLINE Y Linked Acc Trns THOMAS L", "ONLINE Y4527727152 Linked Acc Trns THOMAS L");
    expect(a).toBe(b);
  });

  it("returns an empty key when there is nothing to key on", () => {
    expect(payeeKey("", "1234 5678")).toBe("");
    expect(payeeKey(null, null)).toBe("");
  });

  it("lists merchant and description keys as candidates", () => {
    expect(candidateKeys("Coles", "COLES 4420 COOLUM BEACH")).toEqual(["COLES", "COLES COOLUM"]);
  });
});
