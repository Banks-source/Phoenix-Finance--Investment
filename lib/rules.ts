// Deterministic categorisation rules mapping bank descriptions to the locked
// taxonomy (PRD §7). Rules are ordered — first match wins. Structural patterns
// (income, transfers, fees) are checked before merchant keywords so a "SALARY"
// or "Transfer to" line is never miscategorised as spending.
//
// This is intentionally rule-based (not AI) for the tax path: fast, free,
// and auditable. The Claude fallback in categorise.ts only runs for rows that
// match nothing here.
import { TxnType } from "./taxonomy";

export interface Rule {
  re: RegExp;
  category: string;
  sub_category?: string;
  type: TxnType;
}

// Matched against an uppercased `${detail} ${merchant}` string.
export const RULES: Rule[] = [
  // ---- Income -------------------------------------------------------------
  { re: /\bSALARY\b/, category: "Income", sub_category: "Salary", type: "income" },
  { re: /SALARY MYER|MYER PTY LTD/, category: "Income", sub_category: "Salary", type: "income" },
  { re: /IAG SERVICES/, category: "Income", sub_category: "Salary", type: "income" },
  { re: /RENT DISBURSEMENT|BEYOND PROPERTY/, category: "Income", sub_category: "Rent received", type: "income" },
  { re: /CREDIT INTEREST|\bINTEREST PAID\b/, category: "Income", sub_category: "Interest", type: "income" },
  { re: /MCARE BENEFITS|MEDICARE BENEFIT|MCARE/, category: "Income", sub_category: "Medicare refund", type: "income" },
  { re: /PETSURE CLAIMS|CLAIMS LLOYD/, category: "Income", sub_category: "Insurance claim", type: "income" },

  // ---- Fees & interest charged -------------------------------------------
  { re: /NAB INTNL TRAN FEE|INTERNATIONAL TRANSACTION FEE/, category: "Fees", sub_category: "Intl fee", type: "bills_fixed" },
  { re: /INTEREST ON PURCHASE|INTEREST CHARGED|DEBIT INT RATE/, category: "Fees", sub_category: "Interest charged", type: "bills_fixed" },

  // ---- Debt repayments (creditors — see PRD known gap) --------------------
  { re: /WESTPAC PAYMENT/, category: "Money Movement", sub_category: "Westpac repayment", type: "debt" },
  { re: /\bRUDY\b|RUDOLPH THOMAS/, category: "Money Movement", sub_category: "Rudy", type: "debt" },
  { re: /ASHBY LOAN|ASHBY/, category: "Money Movement", sub_category: "Ashby Loan", type: "debt" },
  { re: /ZIPMONEY|ZIP MONEY/, category: "Money Movement", sub_category: "ZipMoney", type: "debt" },

  // ---- Transfers / money movement ----------------------------------------
  { re: /LINKED ACC TRNS|INTERNET PAYMENT|LINKED ACC/, category: "Money Movement", sub_category: "Card payment", type: "transfers" },
  { re: /TRANSFER (TO|FROM|DEBIT|CREDIT|IN|OUT)|FAST TRANSFER|INTERNET TRANSFER|COMMBANK APP/, category: "Money Movement", type: "transfers" },
  { re: /\bBPAY\b|PAYID|NETBANK/, category: "Money Movement", type: "transfers" },
  { re: /CBA ATM|ATM DEBIT|CASH WITHDRAWAL|CASH WITHDRAWL/, category: "Money Movement", sub_category: "Cash Withdrawal", type: "needs_categorisation" },
  { re: /MILANI SIMIC|LLOYD THOMAS|LLOYD EDWARD THOMA/, category: "Money Movement", sub_category: "Internal transfer", type: "transfers" },

  // ---- Subscriptions / tech ----------------------------------------------
  { re: /NETFLIX|HUBBL|KAYO|BINGE|DISNEY|SPOTIFY|STAN\b|AMAZON PRIME/, category: "Subscriptions", type: "bills_fixed" },
  { re: /APPLE\.COM\/BILL|APPLE\.COM|ITUNES/, category: "Subscriptions", sub_category: "Apple", type: "bills_fixed" },
  { re: /OPENAI|CHATGPT|ANTHROPIC|CLAUDE|MICROSOFT|EXPRESSVPN|KUBERA|HETZNER|GOOGLE (WORKSPACE|CLOUD|TV|AUSTRALIA)|GOOGLE TV/, category: "Subscriptions", sub_category: "Software", type: "bills_fixed" },

  // ---- Utilities / phone --------------------------------------------------
  { re: /ELGAS|AGL\b|ORIGIN ENERGY|ENERGY AUSTRALIA|ERGON/, category: "Utilities", sub_category: "Energy", type: "bills_fixed" },
  { re: /TELSTRA|DODO|BELONG|OPTUS|VODAFONE|AUSSIE BROADBAND|SUPERLOOP/, category: "Utilities", sub_category: "Phone & internet", type: "bills_fixed" },

  // ---- Insurance ----------------------------------------------------------
  { re: /NRMA|RACV|MEDIBANK|PETSURE|PET INSURANCE|AAMI|ALLIANZ|BUPA|NIB\b|SUNCORP INS/, category: "Insurance", type: "bills_fixed" },

  // ---- Rent / school fees (fixed) ----------------------------------------
  { re: /COOLUM COASTAL|LANG29ML/, category: "Kids", sub_category: "School fees", type: "spending" },
  { re: /EDSTART|BESTACADEMY|PEREGIAN KIDS|MY SCHOOL (CONNECT|TUCKSHOP)|SUNSHINE COAST SPORTS/, category: "Kids", sub_category: "School / activities", type: "spending" },

  // ---- Health / medical ---------------------------------------------------
  { re: /PHARMACY|CHEMIST|CARDIO|PATHOLOGY|RESPIRATORY|ACUPUNCTURE|MEDICAL|FAMILY PRACTICE|DENTAL|PHYSIO|SULLIVAN NICOLAIDES|NOOSA HEARTS|SUNSHINE COAST RESPI|LIVELIFE/, category: "Health", type: "spending" },

  // ---- Personal care ------------------------------------------------------
  { re: /FRESHA|QUEEN NAILS|COSMETIC STUDIO|HAIR|BARBER|BEAUTY|NAILS|SPA\b/, category: "Personal Care", type: "spending" },

  // ---- Pets ---------------------------------------------------------------
  { re: /PETBARN|DOGGIE ADVENTURE|STEAMPUNK PUPPIES|PET STORE|VET\b/, category: "Pets", type: "spending" },

  // ---- Fuel & transport ---------------------------------------------------
  { re: /\bUBER\b|UBERDIRECT|DIDI\b|OLA\b|TAXI/, category: "Car & Transport", sub_category: "Rideshare", type: "spending" },
  { re: /\bBP\b|7-ELEVEN|7 ELEVEN|UNITED (COOLUM|PETROLEUM)|REDDY EXPRESS|CALTEX|SHELL|AMPOL|MOBIL|FUEL/, category: "Car & Transport", sub_category: "Fuel", type: "spending" },
  { re: /POINT PARKING|BAC PARKING|PARKING|TOLL|LINKT|E-TOLL/, category: "Car & Transport", sub_category: "Parking & tolls", type: "spending" },
  { re: /CAR ?WASH|BLIBLICARWASH/, category: "Car & Transport", sub_category: "Car wash", type: "spending" },
  { re: /TRANSLINK|PUBLIC TRANSPORT|GO CARD|MYKI|OPAL/, category: "Transport", type: "spending" },

  // ---- Fines / gambling / government -------------------------------------
  { re: /TMR OFFENCE|OFFENCE|INFRINGEMENT|FINE\b|PENALTY/, category: "Fines", type: "spending" },
  { re: /TATTS|THE LOTT|SPORTSBET|LADBROKES|BET365|TAB\b|POINTSBET/, category: "Gambling", type: "spending" },
  { re: /CENTRELINK|CLINK DIR DEBIT/, category: "Money Movement", sub_category: "Centrelink", type: "transfers" },
  { re: /ASIC|AUSTRALIAN SECURITIES|VIC PROPERTY CERTS|LANDATA|LAND TAX|GOVERNMENT/, category: "Investment", sub_category: "Property/gov", type: "transfers" },

  // ---- Groceries ----------------------------------------------------------
  { re: /WOOLWORTHS|WOOLIES|COLES|ALDI|IGA\b|WHITES IGA|FOODWORKS|BUDDSBUTCHERS|MT COOLUM MEATS|MEATS|BUTCHER|HEIRLOOM WHOLEFOOD|BAKERY|EZYMART|CANTALOUPE/, category: "Groceries", type: "spending" },

  // ---- Dining out ---------------------------------------------------------
  { re: /MCDONALD|KFC|HUNGRY JACK|SUBWAY|DOMINO|PIZZA|SUSHI|KEBAB|CAFE|COFFEE|ESPRESSO|RESTAURANT|BISTRO|\bPUB\b|HOTEL|BAR\b|BREW|EATERY|GRILL|NOODLE|THAI|MEXICAN|BURGER|TAKEAWAY|DONA MEXI|PEDAS|ROSA ITALIAN|ROYAL MAIL|DOONAN|MISSCHU|WAGTAIL|BOULANGE|MEBAMI|TOP JUICE|GELARE|COCA-?COLA|BEACHSIDE|CHOPSTICKS|SMOKE HOUSE|MOCHA|BOBBI LANE|AXIL|CUB ESPRESSO|HADZ|ALLEY CAT|LUMA COFFEE|WELLINGTON BAKERY|SG BAKERY|MA BOULANGE|EVERYDAY COFFEE|REX & TURTLE|GLASSHOUSE GRIND|EMPORIUM ESPRESSO|BELLISSIMO|ORIENT HOTEL|NEVAGGIO|SINDBAD|UNIGO|FORTUNE SUNSHINE|J1 SUSHI|SUSHIRO|ELYSIUM|COCO CANTINA|SCRAM ENTERPRISES|MARIELLA|DEALS AND DOLLARS|THE LOCAL|THE SHOP PRODUCTS|CoolUM FOOTBALL|TIMEZONE/, category: "Dining Out", type: "spending" },

  // ---- Shopping -----------------------------------------------------------
  { re: /AFTERPAY|PAYPAL|PYPL|ZIP\b|KMART|BIG W|TARGET|AMAZON|EBAY|SHEIN|UNIQLO|ZARA|H&M|COTTON ON|SPENDLESS|CATCH|TEMU|ELLE AURA|AMAZEN PUZZLES|OFFICIALYUR|COSTUMES|MARC STEWART|SPORTS DIRECT|REBEL SPORT|INTERSPORT|BUNNINGS|OFFICEWORKS|DISCOUNTS GALORE|DEALS AND DOLLARS|SCHOOL LOCKER|EZY CANDY|SP EZY|SAFENRO/, category: "Shopping", type: "spending" },

  // ---- Entertainment ------------------------------------------------------
  { re: /CINEMA|MOVIE|EVENT CINEMA|BIRCH CARROLL|GREATER UNION|BCC CINEMA|READING CINEMA|TICKETEK|TICKETMASTER|STEAM GAMES|PLAYSTATION|XBOX|NINTENDO|TIMEZONE/, category: "Entertainment", type: "spending" },

  // ---- Donations ----------------------------------------------------------
  { re: /DONATION|RED CROSS|SALVATION ARMY|VINNIES|UNICEF|OXFAM|WORLD VISION/, category: "Donations", type: "spending" },

  // ---- Kids sport clubs ---------------------------------------------------
  { re: /FOOTBALL CL|LIONS FOOTBA|UNITED FO|COOROORA|NETBALL|CRICKET CLUB|JUNIOR RUGBY|NIPPERS|SURF CLUB/, category: "Kids", sub_category: "Sport", type: "spending" },

  // ---- Liquor -------------------------------------------------------------
  { re: /DAN MURPHY|\bBWS\b|LIQUORLAND|FIRST CHOICE LIQUOR|CELLARBRATIONS|BOTTLE ?O/, category: "Dining Out", sub_category: "Alcohol", type: "spending" },

  // ---- Extra food / cafe merchants ---------------------------------------
  { re: /SFS SCUH|SCUH |MATSO|YIROS|RICE BOI|ROLLD|NGON|GRANDMA DANG|HAPPY DOUGH|MONKEY PUNCH|FUDGEES|FIOR DI LATTE|COOLUM SOCIAL|BEAN THERE|ROADSIDE ROAST|KENILWORTH COUNTRY BAK|BAKERS DELIGHT|SEAFOOD|DELI\b|FISH ?&? ?CHIP|IGA EXPRESS|KOMEKHUN|MOUNT COOLUM MT/, category: "Dining Out", type: "spending" },

  // ---- Square merchants (overwhelmingly food/cafe here) — last resort -----
  { re: /\bSQ \*/, category: "Dining Out", type: "spending" },
];

// NAB's own category → app taxonomy fallback (used when no keyword rule hits).
export const NAB_CATEGORY_MAP: Record<string, { category: string; type: TxnType }> = {
  "Taxis & ride shares": { category: "Car & Transport", type: "spending" },
  "Fuel": { category: "Car & Transport", type: "spending" },
  "Parking & tolls": { category: "Car & Transport", type: "spending" },
  "Public transport": { category: "Transport", type: "spending" },
  "Cafe & coffee": { category: "Dining Out", type: "spending" },
  "Restaurants & takeaway": { category: "Dining Out", type: "spending" },
  "Groceries": { category: "Groceries", type: "spending" },
  "Clothing & accessories": { category: "Shopping", type: "spending" },
  "Other shopping": { category: "Shopping", type: "spending" },
  "Electronics & technology": { category: "Shopping", type: "spending" },
  "Services": { category: "Shopping", type: "spending" },
  "Subscriptions": { category: "Subscriptions", type: "bills_fixed" },
  "Phone & internet": { category: "Utilities", type: "bills_fixed" },
  "Utilities": { category: "Utilities", type: "bills_fixed" },
  "Insurance": { category: "Insurance", type: "bills_fixed" },
  "Fees": { category: "Fees", type: "bills_fixed" },
  "Medical": { category: "Health", type: "spending" },
  "Gym & fitness": { category: "Health", type: "spending" },
  "Personal care": { category: "Personal Care", type: "spending" },
  "Education": { category: "Kids", type: "spending" },
  "Gambling": { category: "Gambling", type: "spending" },
  "Government": { category: "Bills", type: "bills_fixed" },
  "Internal transfers": { category: "Money Movement", type: "transfers" },
  "Transfers in": { category: "Money Movement", type: "transfers" },
  "Transfers out": { category: "Money Movement", type: "transfers" },
  "Cash": { category: "Money Movement", type: "transfers" },
  "Refund": { category: "Income", type: "income" },
  "Income": { category: "Income", type: "income" },
};

export interface RuleMatch {
  category: string;
  sub_category: string | null;
  type: TxnType;
  method: "keyword_rule" | "nab_category" | "unmatched";
  confidence: number;
}

/** Deterministic categorisation: keyword rules first, then NAB's own category. */
export function ruleCategorise(
  detail: string,
  merchant: string,
  bankCategory?: string | null
): RuleMatch {
  const hay = `${detail} ${merchant}`.toUpperCase();
  for (const rule of RULES) {
    if (rule.re.test(hay)) {
      return {
        category: rule.category,
        sub_category: rule.sub_category ?? null,
        type: rule.type,
        method: "keyword_rule",
        confidence: 0.9,
      };
    }
  }
  if (bankCategory && NAB_CATEGORY_MAP[bankCategory]) {
    const m = NAB_CATEGORY_MAP[bankCategory];
    return { category: m.category, sub_category: null, type: m.type, method: "nab_category", confidence: 0.6 };
  }
  return { category: "Financial", sub_category: null, type: "needs_categorisation", method: "unmatched", confidence: 0 };
}
