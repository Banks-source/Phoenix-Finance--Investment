import { describe, it, expect } from "vitest";
import { classifyHolding } from "./sleeves";

describe("classifyHolding", () => {
  it("classifies crypto assetClass as btc_crypto", () => {
    expect(classifyHolding({ id: "1", name: "Bitcoin", assetClass: "crypto" })).toEqual({
      sleeve: "btc_crypto",
      method: "crypto_rule",
    });
    expect(classifyHolding({ id: "2", name: "Dogecoin", assetClass: "crypto" })).toEqual({
      sleeve: "btc_crypto",
      method: "crypto_rule",
    });
  });

  it("classifies cash assetClass as dry_powder", () => {
    expect(classifyHolding({ id: "3", name: "Australian Dollars", assetClass: "cash" })).toEqual({
      sleeve: "dry_powder",
      method: "cash_rule",
    });
  });

  it("classifies known investment-property names as property, regardless of assetClass", () => {
    for (const name of ["68 Tyquin St", "70 Tyquin St", "Ashby Crt", "U1 Powlett St", "U2 Powlett St"]) {
      expect(classifyHolding({ id: "p", name, assetClass: "investment" })).toEqual({
        sleeve: "property",
        method: "property_rule",
      });
    }
  });

  it("property name match takes priority over assetClass rules", () => {
    // Wouldn't happen in real data, but the property check must run first.
    expect(classifyHolding({ id: "4", name: "Ashby Crt", assetClass: "crypto" })).toEqual({
      sleeve: "property",
      method: "property_rule",
    });
  });

  it("leaves anything else genuinely unmapped rather than guessing", () => {
    expect(classifyHolding({ id: "5", name: "Goodman Group", assetClass: "stock" })).toEqual({
      sleeve: null,
      method: "unmapped",
    });
    expect(classifyHolding({ id: "6", name: "Biofuels", assetClass: "investment" })).toEqual({
      sleeve: null,
      method: "unmapped",
    });
    expect(classifyHolding({ id: "7", name: "UniSuper", assetClass: "investment" })).toEqual({
      sleeve: null,
      method: "unmapped",
    });
  });
});
