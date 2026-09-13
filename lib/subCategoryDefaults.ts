// Derives a sensible default sub-category from a merchant name so a
// transaction with none yet isn't blank in the Review queue — a starting
// point to confirm or edit, not an attempt to guess the "right" answer.
// Conservative by design: strips obvious noise (store numbers, suburb/state/
// country tails, card/value-date boilerplate, parenthetical locations) and
// falls back to the original text whenever that would leave nothing.

const COUNTRY_OR_DOMAIN_NOISE = /^(AU|AUS|AUSTRALIA|NSW|VIC|QLD|QL|WA|SA|TAS|NT|ACT)$/i;
const DOMAIN_SUFFIX = /\.(com|com\.au|net|org)$/i;
// Known brand acronyms longer than 3 letters — a length check alone can't
// tell "NRMA" from an ordinary short word like "CAFE", so these are explicit.
const KNOWN_ACRONYMS = new Set(["NRMA", "RACV", "AAMI", "NIB", "ATO", "ASIC"]);

function stripCardAndDateNoise(s: string): string {
  return s
    .replace(/,?\s*Card\s+xx?\d+.*$/i, "")
    .replace(/,?\s*Value\s*Date:?.*$/i, "")
    .trim();
}

function stripTrailingParenthetical(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function stripTrailingStoreNumberAndTail(s: string): string {
  const m = s.match(/\s\d{3,}\b/);
  if (!m || m.index === undefined || m.index === 0) return s;
  return s.slice(0, m.index).trim();
}

function stripTrailingCountryOrDomainTokens(s: string): string {
  const tokens = s.split(/\s+/);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1].replace(/[.,]+$/, "");
    if (COUNTRY_OR_DOMAIN_NOISE.test(last) || DOMAIN_SUFFIX.test(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ").trim();
}

function titleCasePreservingAcronyms(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      const isShoutingWord = w === w.toUpperCase() && /[A-Z]/.test(w);
      if (isShoutingWord && (w.length <= 3 || KNOWN_ACRONYMS.has(w))) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function deriveDefaultSubCategory(merchant: string | null, detail: string | null): string {
  const original = (merchant?.trim() || detail?.trim() || "").trim();
  if (!original) return "";

  let s = original;
  s = stripCardAndDateNoise(s);
  s = stripTrailingParenthetical(s);
  s = stripTrailingStoreNumberAndTail(s);
  s = stripTrailingCountryOrDomainTokens(s);
  s = s.trim();

  if (!s) return titleCasePreservingAcronyms(original);
  return titleCasePreservingAcronyms(s);
}
