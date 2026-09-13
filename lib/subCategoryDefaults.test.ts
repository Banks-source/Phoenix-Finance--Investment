import { describe, it, expect } from "vitest";
import { deriveDefaultSubCategory } from "./subCategoryDefaults";

describe("deriveDefaultSubCategory", () => {
  it("strips a store number and everything after it (suburb/state/country)", () => {
    expect(deriveDefaultSubCategory("Coles 8758 Peregian Sprs Ql Aus", null)).toBe("Coles");
    expect(deriveDefaultSubCategory("Woolworths 2617 Coolum Beach Ql Aus", null)).toBe("Woolworths");
    expect(deriveDefaultSubCategory("ALH Venues 8283 Buderim Ql Aus", null)).toBe("ALH Venues");
  });

  it("strips a trailing parenthetical location", () => {
    expect(deriveDefaultSubCategory("Hanami (Coolum Beach)", null)).toBe("Hanami");
    expect(deriveDefaultSubCategory("Hubbl (Kayo Sports & Binge)", null)).toBe("Hubbl");
    expect(deriveDefaultSubCategory("Good Bean (Youi)", null)).toBe("Good Bean");
    expect(deriveDefaultSubCategory("N Thai Sing (Mooloolaba)", null)).toBe("N Thai Sing");
  });

  it("strips a trailing country code and a domain-like token", () => {
    expect(deriveDefaultSubCategory("Afterpay afterpay.com.au Aus", null)).toBe("Afterpay");
  });

  it("leaves an already-clean merchant name untouched (just normalised case)", () => {
    expect(deriveDefaultSubCategory("NRMA", null)).toBe("NRMA");
    expect(deriveDefaultSubCategory("Medibank", null)).toBe("Medibank");
    expect(deriveDefaultSubCategory("Cub Espresso", null)).toBe("Cub Espresso");
  });

  it("strips card/value-date boilerplate and a trailing state/country pair from a detail-only fallback", () => {
    expect(deriveDefaultSubCategory(null, "SWELL CAFE SCA NAMBOUR QL AUS Card xx1075 Value Date: 10/04/2026")).toBe(
      "Swell Cafe SCA Nambour"
    );
  });

  it("only strips a trailing state/country token, leaving an in-the-middle region name alone", () => {
    expect(deriveDefaultSubCategory("Amazon AU Retail Sydney Aus", null)).toBe("Amazon AU Retail Sydney");
  });

  it("returns empty string when there's no merchant or detail to work with", () => {
    expect(deriveDefaultSubCategory(null, null)).toBe("");
    expect(deriveDefaultSubCategory("", "")).toBe("");
  });
});
