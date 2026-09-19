// Splits the undifferentiated "Money Movement" bucket into transfers between
// our own accounts (net-worth neutral) vs money that actually left the
// household to someone/somewhere else. Deliberately conservative — per the
// "no silent guessing" rule, anything that can't be matched with confidence
// against a known account or name is left unclassified for manual review
// rather than guessed at.

export type TransferDirection = "Internal transfer" | "External transfer";

// Both spouses' name variants seen in real bank descriptions (e.g. Milani's
// full legal name "MRS MILANI BIANCA SIM(IC)" gets truncated by some banks).
function hasOurName(hay: string): boolean {
  return (hay.includes("LLOYD") && hay.includes("THOMA")) || (hay.includes("MILANI") && hay.includes("SIM"));
}

// Digit-bounded match — a bare .includes() would also match a 4-digit
// account number inside an unrelated longer reference code by coincidence
// (e.g. a ZipMoney code happening to contain "8814").
function hasOurAccountDigits(hay: string, ourAccountDigits: string[]): boolean {
  return ourAccountDigits.some((d) => {
    if (d.length < 4) return false;
    const re = new RegExp(`(?<!\\d)${d}(?!\\d)`);
    return re.test(hay);
  });
}

// Matches the "Transfer To X, ..." / "Fast Transfer From X, ..." shape common
// in CBA/NAB app-generated descriptions, capturing the counterparty name.
const NAMED_TRANSFER_RE = /(?:TRANSFER (?:TO|FROM)|FAST TRANSFER (?:TO|FROM))\s+([A-Z][A-Z .]{2,40}?)(?:,|$)/;

// Matches NAB's bare "<Name> <reference code>" linked-account style, e.g.
// "SUSAN THOMAS N4545136827 PAYMENT" or "MARQUETTA MANOKARAN A1385319327".
const BARE_NAME_CODE_RE = /^([A-Z][A-Z .]{2,30}?)\s+[A-Z]\d{6,}\b/;

// Words that show up in the name slot but mean "one of our own accounts by
// nickname" rather than a genuine external payee — ambiguous, so excluded
// rather than guessed at as external.
const AMBIGUOUS_NAME_WORDS = /\b(NAB|CBA|BANK|BANKS|COMMBANK|NETBANK|WESTPAC|PAYID|PHONE|APP)\b/;

/**
 * Returns the transfer direction for a "Money Movement" transaction's detail
 * text, or null when it can't be determined with confidence (bare BPAY/PAYID
 * codes, single-word institution payouts, ambiguous nicknames, etc.).
 */
export function classifyMoneyMovement(detail: string | null, ourAccountDigits: string[]): TransferDirection | null {
  const hay = (detail ?? "").toUpperCase();
  if (!hay) return null;

  if (hasOurAccountDigits(hay, ourAccountDigits)) return "Internal transfer";
  if (hasOurName(hay)) return "Internal transfer";

  const m = hay.match(NAMED_TRANSFER_RE) ?? hay.match(BARE_NAME_CODE_RE);
  if (m) {
    const name = m[1].trim();
    const wordCount = name.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 2 && !AMBIGUOUS_NAME_WORDS.test(name)) {
      return "External transfer";
    }
  }

  return null;
}

/**
 * The full Money Movement bucket scheme (Internal/External transfer plus the
 * remaining catch-alls: card payments, cash withdrawals, ZipMoney, Centrelink)
 * — always returns a bucket, unlike classifyMoneyMovement which returns null
 * when direction can't be determined.
 */
export function deriveMoneyMovementSubCategory(
  detail: string | null,
  merchant: string | null,
  ourAccountDigits: string[]
): string {
  const direction = classifyMoneyMovement(detail, ourAccountDigits);
  if (direction) return direction;

  const hay = `${detail ?? ""} ${merchant ?? ""}`.toUpperCase();
  if (/CBA ATM|ATM DEBIT|CASH WITHDRAWAL|CASH WITHDRAWL|CASHCARD ATM|INDEPENDENT ATM/.test(hay)) {
    return "Cash Withdrawal";
  }
  // A bare "WITHDRAWAL" with no ATM wording is how the Westpac Flexi Loan
  // (buffer) labels money moved out — not cash in hand.
  if (/\bWITHDRAWAL\b/.test(hay)) return "Internal transfer";
  if (/ZIPMONEY|ZIP MONEY/.test(hay)) return "ZipMoney";
  if (/CENTRELINK|CLINK DIR DEBIT/.test(hay)) return "Centrelink";
  if (/LINKED ACC TRNS|INTERNET PAYMENT|LINKED ACC|\bBPAY\b|PAYID|NETBANK|INTERNET TRANSFER/.test(hay)) {
    return "Card payment";
  }
  return "Needs review";
}

// A big move to/from the Westpac buffer loan could be a real paydown or a
// temporary top-up — identical in the data. Rather than guess, anything at or
// above this is routed to Review for an explicit Internal transfer / Debt
// paydown decision. Smaller everyday movements stay Internal transfer.
export const BUFFER_DECISION_THRESHOLD = 2000;

export function needsBufferDecision(detail: string | null, amount: number): boolean {
  if (Math.abs(amount) < BUFFER_DECISION_THRESHOLD) return false;
  return /WESTPAC PAYMENT|TFR FROM WESTPA/i.test(detail ?? "");
}

/** Pulls 4+ digit runs out of an account label or masked number for matching. */
export function extractAccountDigits(...values: (string | null | undefined)[]): string[] {
  const digits = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    for (const m of v.matchAll(/\d{4,}/g)) {
      digits.add(m[0]);
      // Also keep the last 4 digits alone, since masked numbers/full numbers
      // and "xx1234"-style detail text don't always share the same length.
      digits.add(m[0].slice(-4));
    }
  }
  return [...digits];
}
