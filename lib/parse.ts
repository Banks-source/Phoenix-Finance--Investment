// Bank CSV parsers. Two real-world formats from the household's exports:
//
//  NAB  — has a header row. Columns:
//         Date(DD Mon YY), Amount, Account Number, [blank], Transaction Type,
//         Transaction Details, Balance, Category(NAB's own), Merchant Name, Processed On
//  CBA  — no header. Columns:
//         Date(DD/MM/YYYY), Amount(signed), Description, Running Balance
//
// Both are normalised to a common RawTxn shape used by the categorisation
// engine and the import pipeline.
import Papa from "papaparse";

export type Institution = "NAB" | "CBA";
export type Owner = "lloyd" | "milani";

export interface RawTxn {
  date: string; // ISO YYYY-MM-DD
  amount: number; // signed: negative = money out, positive = money in
  institution: Institution;
  owner: Owner;
  account: string; // account label / masked card
  transaction_type: string;
  detail: string; // full raw description
  merchant: string; // best-effort clean merchant
  bank_category: string | null; // the bank's own category (NAB only)
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "30 Jun 26" -> "2026-06-30" */
export function parseNabDate(s: string): string {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/);
  if (!m) return "";
  const day = m[1].padStart(2, "0");
  const mon = MONTHS[m[2].toLowerCase()];
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return mon ? `${year}-${mon}-${day}` : "";
}

/** "29/06/2026" -> "2026-06-29" */
export function parseCbaDate(s: string): string {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function num(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[+,$"]/g, "").trim()) || 0;
}

/** Auto-detect institution from the raw CSV text. */
export function detectInstitution(csv: string): Institution {
  const firstLine = csv.trimStart().split(/\r?\n/)[0] ?? "";
  if (/^Date\s*,\s*Amount\s*,\s*Account Number/i.test(firstLine)) return "NAB";
  return "CBA";
}

export function ownerForInstitution(inst: Institution): Owner {
  return inst === "CBA" ? "milani" : "lloyd";
}

// ---- CBA description → clean merchant --------------------------------------
// e.g. "WOOLWORTHS 2617 COOLUM BEACH QL AUS Card xx1075 Value Date: 26/06/2026"
//      -> "Woolworths"
export function cleanCbaMerchant(detail: string): string {
  let s = detail
    .replace(/\s+Card xx\d+.*$/i, "")
    .replace(/\s+Value Date:.*$/i, "")
    .replace(/\s+AUS?$/i, "")
    .replace(/\s+(QLD?|NSW|VIC|SA|WA|TAS|NT|ACT)\b.*$/i, "")
    .trim();
  // Drop trailing store numbers / reference codes.
  s = s.replace(/\s+\d{3,}$/, "").trim();
  return s || detail.trim();
}

// ---- NAB parser -------------------------------------------------------------
export function parseNab(csv: string): RawTxn[] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  const rows = parsed.data;
  const out: RawTxn[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i === 0 && /date/i.test(r[0]) && /amount/i.test(r[1] ?? "")) continue; // header
    const date = parseNabDate(r[0] ?? "");
    if (!date) continue;
    const amount = num(r[1]);
    const account = (r[2] ?? "").trim();
    const transaction_type = (r[4] ?? "").trim();
    const detail = (r[5] ?? "").trim();
    const bank_category = (r[7] ?? "").trim() || null;
    const merchantName = (r[8] ?? "").trim();
    out.push({
      date,
      amount,
      institution: "NAB",
      owner: "lloyd",
      account,
      transaction_type,
      detail,
      merchant: merchantName || detail,
      bank_category,
    });
  }
  return out;
}

// ---- CBA parser -------------------------------------------------------------
export function parseCba(csv: string): RawTxn[] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  const out: RawTxn[] = [];
  for (const r of parsed.data) {
    const date = parseCbaDate(r[0] ?? "");
    if (!date) continue;
    const amount = num(r[1]);
    const detail = (r[2] ?? "").trim();
    out.push({
      date,
      amount,
      institution: "CBA",
      owner: "milani",
      account: "CBA",
      transaction_type: "",
      detail,
      merchant: cleanCbaMerchant(detail),
      bank_category: null,
    });
  }
  return out;
}

/** Parse a raw CSV, auto-detecting the bank format. */
export function parseBankCsv(csv: string, institution?: Institution): RawTxn[] {
  const inst = institution ?? detectInstitution(csv);
  return inst === "NAB" ? parseNab(csv) : parseCba(csv);
}
