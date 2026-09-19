// The sub-category rule engine: maps a transaction's merchant/detail text to
// one of a small, curated set of sub-categories per category (see
// supabase/migrations/0013_sub_categories.sql for the canonical list this
// mirrors). Deliberately keyword-based and auditable, same reasoning as
// lib/rules.ts — first match wins, falls back to a category-appropriate
// "Other"/catch-all bucket rather than inventing something more specific.
//
// Money Movement isn't here — its Internal/External split needs the
// account-digit/name matching in lib/transferClassification.ts, so it's
// handled separately in the backfill script that calls this.

export interface SubCategoryRule {
  re: RegExp;
  sub: string;
}

export const CONSOLIDATION_RULES: Record<string, SubCategoryRule[]> = {
  "Dining Out": [
    { re: /MCDONALD|KFC|HUNGRY JACK|SUBWAY|DOMINO|PIZZA HUT|GUZMAN/, sub: "Fast Food" },
    { re: /CAFE|COFFEE|ESPRESSO|JUICE|JUCIE|BAKERY|PATISSERIE/, sub: "Cafe & Coffee" },
    { re: /\bPUB\b|\bBAR\b|HOTEL|ALH VENUES|TAVERN|BREWERY|BREW\b/, sub: "Pubs & Bars" },
    { re: /UBER EATS|MENULOG|DOORDASH|DELIVEROO/, sub: "Delivery" },
    { re: /FOOTBALL CL|SURF LIFE SAVING|LIONS FOOTBA|SOCIAL CLUB|BOWLS CLUB/, sub: "Clubs" },
  ],

  Shopping: [
    { re: /AFTERPAY|PAYPAL.*PAY ?IN ?4|PYPL.*PAYIN4|\bZIP\b/, sub: "Buy Now Pay Later" },
    { re: /AMAZON/, sub: "Amazon" },
    { re: /\bBIG W\b|\bKMART\b|\bMYER\b|\bTARGET\b/, sub: "Department Store" },
    { re: /DEALS AND DOLLARS|DISCOUNTS GALORE|DISCOUNT/, sub: "Discount & Variety" },
    { re: /REBEL SPORT|SPORTS DIRECT|INTERSPORT/, sub: "Sporting Goods" },
  ],

  Groceries: [
    { re: /\bCOLES\b/, sub: "Coles" },
    { re: /WOOLWORTHS|WOOLIES/, sub: "Woolworths" },
    { re: /\bALDI\b/, sub: "Aldi" },
    { re: /MEATS|BUTCHER/, sub: "Butcher" },
    { re: /\bIGA\b|EZYMART|FOODWORKS/, sub: "Convenience" },
    { re: /DAN MURPHY|BWS\b|LIQUORLAND|CELLARBRATIONS|BOTTLE ?O/, sub: "Liquor" },
  ],

  Kids: [
    { re: /COLLEGE|ACADEMY|EDSTART/, sub: "School Fees" },
    { re: /MY SCHOOL CONNECT|SCHOOL LOCKER|TUCKSHOP/, sub: "School Extras" },
    { re: /FOOTBALL|OZTAG|LIONS|NETBALL|RUGBY|NIPPERS|SURF CLUB|SPORTS\b/, sub: "Sport" },
    { re: /DINOSAUR WORLD|ZAX AMUSEMENTS|CLIMB N|NOOSA LEISURE|STRIKE\b|TIMEZONE/, sub: "Entertainment" },
  ],

  "Car & Transport": [
    { re: /\bUBER\b|DIDI\b|OLA\b/, sub: "Rideshare" },
    { re: /PETROLEUM|7-ELEVEN|7 ELEVEN|\bBP\b|AMPOL|EG GROUP|CALTEX|SHELL|MOBIL|FUEL/, sub: "Fuel" },
    { re: /PARKING|\bLINKT\b|\bMYKI\b|TRANSLINK|TOLL|E-TOLL/, sub: "Parking & Tolls" },
    { re: /CAR ?WASH|DOG ?WASH/, sub: "Car Wash" },
    { re: /DEPARTMENT OF TRANSPORT|MAIN ROADS|REGO|REGISTRATION/, sub: "Government" },
  ],

  Subscriptions: [
    { re: /OPENAI|CHATGPT|ANTHROPIC|CLAUDE|KUBERA|HETZNER|EXPRESSVPN|CANVA/, sub: "AI & Software" },
    { re: /NETFLIX|HUBBL|KAYO|BINGE|DISNEY|SPOTIFY|STAN\b/, sub: "Streaming" },
    { re: /APPLE/, sub: "Apple" },
    { re: /GOOGLE/, sub: "Google" },
    { re: /MICROSOFT/, sub: "Microsoft" },
  ],

  Fees: [
    { re: /INTNL TRAN FEE|INTERNATIONAL TRANSACTION FEE/, sub: "International Fee" },
    { re: /INTEREST ON PURCHASE|INTEREST.*BASE PLAN|DEBIT EXCESS INTEREST|DEBIT INT RATE|INTEREST CHARGED/, sub: "Interest Charged" },
    { re: /LOAN ACCOUNT FEE|OVERDRAW FEE|ACCOUNT FEE/, sub: "Account Fee" },
  ],

  "Property Interest (ING)": [
    { re: /LATE PAYMENT FEE|\bFEE\b/, sub: "Loan Fees" },
    { re: /INTEREST/, sub: "Loan Interest" },
  ],

  Health: [
    { re: /MEDICARE|MCARE/, sub: "Medicare" },
    { re: /PHARMACY|CHEMIST|PRICELINE|LIVELIFE/, sub: "Pharmacy" },
    { re: /FAMILY PRACTICE|CARDIO|DENTAL|X-RAY|IMAGING|RESPIRATORY|DOCTOR|MEDICAL\b/, sub: "Medical & Dental" },
    { re: /ACUPUNCTURE|LIFE CYKEL|DISCOUNT HEALTH FOODS|IHERB|VPA AUSTRALIA|WELLNESS/, sub: "Wellness" },
  ],

  Insurance: [
    { re: /\bNRMA\b/, sub: "NRMA" },
    { re: /PETSURE/, sub: "PetSure" },
    { re: /\bRACV\b/, sub: "RACV" },
    { re: /MEDIBANK/, sub: "Medibank" },
  ],

  Investment: [
    { re: /ASHBY/, sub: "Ashby Loan" },
    { re: /CITY COUNCIL|LANDATA|DEPARTMENT OF ENVIRONMENT|LAND TAX|ASIC|AUSTRALIAN SECURITIES/, sub: "Property Rates & Government" },
  ],

  Bills: [{ re: /CITY COUNCIL|COUNCIL/, sub: "Local Government" }],

  Uncategorised: [], // deliberately no rules — genuinely disparate one-offs, see fallback

  Utilities: [
    { re: /BELONG|DODO|TELSTRA|OPTUS|VODAFONE|AUSSIE BROADBAND|SUPERLOOP/, sub: "Phone & Internet" },
    { re: /ENERGY AUSTRALIA|ELGAS|AGL\b|ORIGIN ENERGY|ERGON/, sub: "Energy" },
    { re: /COOLUM COASTAL|LANG29ML|BODY CORPORATE|STRATA/, sub: "Strata & Body Corporate" },
  ],

  Rent: [{ re: /COOLUM COASTAL|LANG29ML|INTERNET TRANSFER/, sub: "Rent Payment" }],

  "Personal Care": [
    { re: /FRESHA|NAILS|COSMETIC STUDIO|BEAUTY|SPA\b/, sub: "Nails & Beauty" },
    { re: /HAIR|BARBER|SOHO\b/, sub: "Hair" },
  ],

  Pets: [
    { re: /PETBARN|PETSTOCK|PET STORE/, sub: "Pet Store" },
    { re: /VET\b|VET SURGERY/, sub: "Vet" },
    { re: /DOGGIE ADVENTURE|DOG ?WASH|PET SIT|DAYCARE/, sub: "Pet Care" },
  ],

  Transport: [{ re: /TRANSLINK|GO CARD|MYKI|OPAL/, sub: "Public Transport" }],

  Fines: [
    { re: /STATE PENALTIES|INFRINGEMENT|OFFENCE|TMR OFFENCE/, sub: "Government Penalty" },
    { re: /CENTRELINK/, sub: "Centrelink" },
  ],

  Travel: [
    { re: /AIRBNB|BOOKING\.COM|HOTEL|EXPEDIA/, sub: "Accommodation" },
    { re: /JETSTAR|VIRGIN AUSTRALIA|QANTAS|REX\b|TIGERAIR/, sub: "Flights" },
  ],

  Gambling: [
    { re: /THE LOTT|LOTTERY|TATTS|POWERBALL/, sub: "Lottery" },
    { re: /CROWN|CASINO/, sub: "Casino" },
    { re: /SPORTSBET|LADBROKES|BET365|TAB\b|POINTSBET/, sub: "Sports Betting" },
  ],

  Donations: [{ re: /CANCER|FOUNDATION|CHARITY|RED CROSS|SALVATION ARMY|VINNIES|UNICEF|OXFAM|WORLD VISION/, sub: "Charity" }],
};

// Bucket used when nothing in a category's rule list matches.
export const CONSOLIDATION_FALLBACK: Record<string, string> = {
  "Dining Out": "Restaurants & Takeaway",
  Shopping: "Other",
  Groceries: "Other",
  Kids: "Other",
  "Car & Transport": "Other",
  Subscriptions: "Other",
  Fees: "Other",
  "Property Interest (ING)": "Loan Interest",
  Health: "Other",
  Insurance: "Other",
  Investment: "Other",
  Bills: "Other",
  Uncategorised: "Not yet reviewed",
  Utilities: "Other",
  Rent: "Other",
  "Personal Care": "Other",
  Pets: "Other",
  Transport: "Other",
  Fines: "Other",
  Travel: "Other",
  Gambling: "Other",
  Donations: "Other",
};

/**
 * Returns the consolidated sub-category for a transaction, or null if this
 * category isn't part of the consolidation scheme (e.g. Income, Family
 * Assistance, or Money Movement — handled elsewhere).
 */
export function deriveConsolidatedSubCategory(category: string, merchant: string | null, detail: string | null): string | null {
  const rules = CONSOLIDATION_RULES[category];
  if (!rules) return null;

  const hay = `${detail ?? ""} ${merchant ?? ""}`.toUpperCase();
  for (const rule of rules) {
    if (rule.re.test(hay)) return rule.sub;
  }
  return CONSOLIDATION_FALLBACK[category] ?? "Other";
}
