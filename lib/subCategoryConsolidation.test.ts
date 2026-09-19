import { describe, it, expect } from "vitest";
import { deriveConsolidatedSubCategory } from "./subCategoryConsolidation";

function d(category: string, merchant: string) {
  return deriveConsolidatedSubCategory(category, merchant, merchant);
}

describe("deriveConsolidatedSubCategory — Dining Out", () => {
  it("classifies fast food, cafes, pubs, delivery, and clubs", () => {
    expect(d("Dining Out", "McDonald's Minyama Minyama Ql Aus")).toBe("Fast Food");
    expect(d("Dining Out", "Cub Espresso")).toBe("Cafe & Coffee");
    expect(d("Dining Out", "The Doonan Pub Doonan Ql Aus")).toBe("Pubs & Bars");
    expect(d("Dining Out", "Uber Eats")).toBe("Delivery");
    expect(d("Dining Out", "SQ *COOLUM FOOTBALL CL Coolum Beach")).toBe("Clubs");
  });

  it("falls back to Restaurants & Takeaway for an ordinary restaurant name", () => {
    expect(d("Dining Out", "Sushiro Pty Ltd Peregian Spri Ql Aus")).toBe("Restaurants & Takeaway");
    expect(d("Dining Out", "Hanami (Coolum Beach)")).toBe("Restaurants & Takeaway");
  });
});

describe("deriveConsolidatedSubCategory — Shopping", () => {
  it("classifies BNPL, Amazon, department stores, discount shops, sporting goods", () => {
    expect(d("Shopping", "Afterpay afterpay.com AU")).toBe("Buy Now Pay Later");
    expect(d("Shopping", "PayPal (Pay in 4)")).toBe("Buy Now Pay Later");
    expect(d("Shopping", "AMAZON AU MARKETPLACE SYDNEY")).toBe("Amazon");
    expect(d("Shopping", "BIG W 0249 NOOSAVILLE")).toBe("Department Store");
    expect(d("Shopping", "DISCOUNTS GALORE MAROOCHYDORE AU")).toBe("Discount & Variety");
    expect(d("Shopping", "Rebel Sport")).toBe("Sporting Goods");
  });

  it("falls back to Other for an unrecognised shop", () => {
    expect(d("Shopping", "Some Random Boutique")).toBe("Other");
  });
});

describe("deriveConsolidatedSubCategory — Groceries", () => {
  it("classifies the major supermarkets, butcher, convenience, and liquor", () => {
    expect(d("Groceries", "COLES 4420 COOLUM BEACH")).toBe("Coles");
    expect(d("Groceries", "WOOLWORTHS 2617 COOLUM BEACH")).toBe("Woolworths");
    expect(d("Groceries", "ALDI STORES BIRTINYA")).toBe("Aldi");
    expect(d("Groceries", "Mount Coolum Meats")).toBe("Butcher");
    expect(d("Groceries", "Whites IGA Peregian Peregian Beac Ql Aus")).toBe("Convenience");
    expect(d("Groceries", "Dan Murphy's")).toBe("Liquor");
  });
});

describe("deriveConsolidatedSubCategory — Money Movement is not handled here", () => {
  it("returns null so the caller falls back to the account/name-based classifier", () => {
    expect(deriveConsolidatedSubCategory("Money Movement", "NAB", "INTERNET PAYMENT Linked Acc Trns")).toBeNull();
  });
});

describe("deriveConsolidatedSubCategory — Kids, Car & Transport, Subscriptions, Fees, Health, Insurance, Investment", () => {
  it("classifies Kids merchants", () => {
    expect(d("Kids", "Perigian Beach College")).toBe("School Fees");
    expect(d("Kids", "My School Connect Seaford VI")).toBe("School Extras");
    expect(d("Kids", "SUNSHINE COAST SPORTS COOLUM BEACH")).toBe("Sport");
    expect(d("Kids", "Dinosaur World")).toBe("Entertainment");
  });

  it("classifies Car & Transport merchants", () => {
    expect(d("Car & Transport", "Uber")).toBe("Rideshare");
    expect(d("Car & Transport", "United Petroleum (Coolum Beach)")).toBe("Fuel");
    expect(d("Car & Transport", "POINT PARKING KAWANA")).toBe("Parking & Tolls");
    expect(d("Car & Transport", "Bli Bli Car Wash & Dog Wash")).toBe("Car Wash");
    expect(d("Car & Transport", "QLD Department of Transport & Main Roads")).toBe("Government");
  });

  it("classifies Subscriptions merchants", () => {
    expect(d("Subscriptions", "OpenAI (ChatGPT)")).toBe("AI & Software");
    expect(d("Subscriptions", "Netflix")).toBe("Streaming");
    expect(d("Subscriptions", "Apple (App Store)")).toBe("Apple");
    expect(d("Subscriptions", "Google Australia")).toBe("Google");
    expect(d("Subscriptions", "Microsoft")).toBe("Microsoft");
  });

  it("classifies Fees merchants", () => {
    expect(d("Fees", "NAB INTNL TRAN FEE - (MC)")).toBe("International Fee");
    expect(d("Fees", "INTEREST ON PURCHASE(S)")).toBe("Interest Charged");
    expect(d("Fees", "LOAN ACCOUNT FEE")).toBe("Account Fee");
  });

  it("classifies Health merchants", () => {
    expect(d("Health", "Medicare")).toBe("Medicare");
    expect(d("Health", "Livelife Pharmacy")).toBe("Pharmacy");
    expect(d("Health", "Noosa Civic Family Practice")).toBe("Medical & Dental");
    expect(d("Health", "BMBS Acupuncture (Coolum Beach)")).toBe("Wellness");
  });

  it("classifies Insurance merchants", () => {
    expect(d("Insurance", "NRMA")).toBe("NRMA");
    expect(d("Insurance", "PetSure")).toBe("PetSure");
    expect(d("Insurance", "RACV")).toBe("RACV");
    expect(d("Insurance", "Medibank")).toBe("Medibank");
  });

  it("classifies Investment merchants, keeping the loan's interest/fees distinct from principal", () => {
    expect(d("Investment", "Transfer To milani CommBank App Ashby loan")).toBe("Ashby Loan");
    expect(deriveConsolidatedSubCategory("Fees", null, "Interest Charge — Ashby INV loan 200411638")).toBe(
      "Ashby Loan Interest"
    );
    expect(d("Fees", "ING loan late payment fee")).toBe("Ashby Loan Fees");
    expect(d("Investment", "Hobsons Bay City Council")).toBe("Property Rates & Government");
  });
});

describe("deriveConsolidatedSubCategory — categories outside the scheme", () => {
  it("returns null for a category with no consolidation rules (Income, Family Assistance)", () => {
    expect(deriveConsolidatedSubCategory("Income", "SALARY", "SALARY")).toBeNull();
    expect(deriveConsolidatedSubCategory("Family Assistance", "RUDY", "RUDY")).toBeNull();
  });
});

describe("deriveConsolidatedSubCategory — Utilities, Rent, Personal Care, Pets, Transport, Fines, Travel, Gambling, Donations", () => {
  it("classifies Utilities merchants", () => {
    expect(d("Utilities", "Belong Mobile")).toBe("Phone & Internet");
    expect(d("Utilities", "Energy Australia")).toBe("Energy");
    expect(d("Utilities", "Coolum Coastal E5815048822 LANG29ML")).toBe("Strata & Body Corporate");
  });

  it("classifies the recurring Rent payment", () => {
    expect(d("Rent", "Coolum Coastal")).toBe("Rent Payment");
  });

  it("classifies Personal Care merchants", () => {
    expect(d("Personal Care", "Fresha")).toBe("Nails & Beauty");
    expect(d("Personal Care", "Leigh Hair")).toBe("Hair");
  });

  it("classifies Pets merchants", () => {
    expect(d("Pets", "PETBARN NOOSAVILLE")).toBe("Pet Store");
    expect(d("Pets", "Coolum Vet Surgery")).toBe("Vet");
    expect(d("Pets", "Doggie Adventure Play Marcoola")).toBe("Pet Care");
  });

  it("classifies Transport, Fines, Travel, Gambling, and Donations merchants", () => {
    expect(d("Transport", "Translink")).toBe("Public Transport");
    expect(d("Fines", "State Penalties Enforcement Registry")).toBe("Government Penalty");
    expect(d("Fines", "Centrelink")).toBe("Centrelink");
    expect(d("Travel", "Airbnb")).toBe("Accommodation");
    expect(d("Travel", "Jetstar")).toBe("Flights");
    expect(d("Gambling", "The Lott")).toBe("Lottery");
    expect(d("Gambling", "Crown")).toBe("Casino");
    expect(d("Donations", "Peter MacCallum Cancer Foundation")).toBe("Charity");
  });
});
