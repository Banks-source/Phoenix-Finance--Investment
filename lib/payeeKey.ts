// A stable "who was this paid to" key for a transaction, so a categorisation
// you make once is remembered for every future transaction from the same payee.
//
// Raw bank text is useless as a key: it carries card suffixes, value dates,
// store numbers, reference numbers and suburbs, all of which change every time
// ("COLES 4420 COOLUM BEACH", "Coles 8758 Peregian Sprs Ql Aus, Card xx1075,
// Value date: 15/10/2026"). The key strips that noise and keeps the first one
// or two meaningful words of the payee name.

const STATES = new Set(["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT", "QL", "VI", "NS", "AU", "AUS"]);
const NOISE = new Set(["PTY", "LTD", "ABN", "ACN", "THE", "AND", "COM", "WWW", "TRIP", "STORES", "STORE"]);
const TITLES = new Set(["MR", "MRS", "MS", "MISS", "DR"]);

/** Memory rules never learn from these — they aren't real payee choices. */
export const UNLEARNABLE_CATEGORIES = new Set(["Uncategorised", "Needs review"]);

function words(s: string): string[] {
  return s
    .replace(/['’`]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** `TRANSFER TO R LEE, PAYID ...` → `TRANSFER TO R LEE`; own-account transfers keep the account digits. */
function transferKey(upper: string): string | null {
  const m = upper.match(/^(?:FAST |OSKO )?TRANSFER\s+(TO|FROM)\s+(.+)$/);
  if (!m) return null;
  const dir = m[1];
  const rest = m[2].split(/,|\bPAYID\b|\bCOMMBANK\b|\bNETBANK\b|\bCREDIT TO\b/)[0].trim();
  const acct = rest.match(/^XX\s?(\d{3,})/);
  if (acct) return `TRANSFER ${dir} XX${acct[1]}`;
  const name = words(rest).filter((w) => !TITLES.has(w)).slice(0, 2);
  return name.length ? `TRANSFER ${dir} ${name.join(" ")}` : null;
}

export function payeeKey(merchant: string | null | undefined, detail?: string | null): string {
  for (const text of [merchant, detail]) {
    const key = keyFromText(text ?? "");
    if (key) return key;
  }
  return "";
}

/** Every key a transaction could be remembered under: its merchant name first, then its raw description. */
export function candidateKeys(merchant: string | null | undefined, detail: string | null | undefined): string[] {
  const keys = [keyFromText(merchant ?? ""), keyFromText(detail ?? "")].filter(Boolean);
  return [...new Set(keys)];
}

function keyFromText(raw: string): string {
  let t = raw.toUpperCase().trim();
  if (!t) return "";

  // drop the "Card xx1075 / Value date" tail banks append to card purchases
  t = t.split(/[, ]*\bCARD\s*XX\d+|[, ]*\bVALUE DATE\b/)[0];

  const transfer = transferKey(t);
  if (transfer) return transfer;

  t = t.replace(/^[A-Z]{2,4}\s?\*\s*/, ""); // payment-processor prefixes: SQ *, ZLR*, SP *
  t = t.replace(/\([^)]*\)/g, " "); // "(Coolum Village)"

  const tokens = words(t).filter(
    (w) => !/\d/.test(w) && !STATES.has(w) && !NOISE.has(w) && w.length > 1
  );
  return tokens.slice(0, 2).join(" ");
}
