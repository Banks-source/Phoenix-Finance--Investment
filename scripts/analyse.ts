/**
 * Offline analysis — reads the raw bank exports in data/raw/, categorises them
 * with the deterministic rule engine, and prints an FY2025-26 tax summary.
 * No database required. Directly serves the tax-return deadline.
 *
 * Usage: npm run analyse
 * Output: console summary + out/apr-jun-2026-categorised.csv
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { parseBankCsv, RawTxn } from "../lib/parse";
import { ruleCategorise } from "../lib/rules";
import { TYPE_LABELS, TxnType } from "../lib/taxonomy";

const DATA_DIR = path.join(__dirname, "../data/raw");
const OUT_DIR = path.join(__dirname, "../out");

interface Categorised extends RawTxn {
  category: string;
  sub_category: string | null;
  type: TxnType;
  method: string;
  confidence: number;
}

// Australian FY: 1 Jul → 30 Jun. FY2025-26 = 2025-07-01 .. 2026-06-30.
function inFY(date: string, fyEndYear: number): boolean {
  const start = `${fyEndYear - 1}-07-01`;
  const end = `${fyEndYear}-06-30`;
  return date >= start && date <= end;
}

function fmt(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  const all: Categorised[] = [];

  for (const file of files) {
    const csv = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
    const rows = parseBankCsv(csv);
    for (const r of rows) {
      const cat = ruleCategorise(r.detail, r.merchant, r.bank_category);
      all.push({ ...r, ...cat });
    }
    console.log(`  ${file}: ${rows.length} rows`);
  }

  console.log(`\nTotal parsed: ${all.length} transactions`);

  const fy = all.filter((t) => inFY(t.date, 2026));
  const dates = fy.map((t) => t.date).sort();
  console.log(`In FY2025-26 (Jul 2025 – Jun 2026): ${fy.length} rows`);
  console.log(`Date range present: ${dates[0]} → ${dates[dates.length - 1]}\n`);

  // ---- By type ------------------------------------------------------------
  const byType: Record<string, { in: number; out: number; count: number }> = {};
  for (const t of fy) {
    byType[t.type] ??= { in: 0, out: 0, count: 0 };
    if (t.amount >= 0) byType[t.type].in += t.amount;
    else byType[t.type].out += t.amount;
    byType[t.type].count++;
  }
  console.log("═══ BY TYPE (FY2025-26) ═══");
  for (const [type, v] of Object.entries(byType).sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out))) {
    const label = TYPE_LABELS[type as TxnType] ?? type;
    console.log(
      `  ${label.padEnd(22)} in ${fmt(v.in).padStart(12)}   out ${fmt(v.out).padStart(12)}   net ${fmt(v.in + v.out).padStart(12)}   (${v.count})`
    );
  }

  // ---- By category --------------------------------------------------------
  const byCat: Record<string, { net: number; count: number }> = {};
  for (const t of fy) {
    byCat[t.category] ??= { net: 0, count: 0 };
    byCat[t.category].net += t.amount;
    byCat[t.category].count++;
  }
  console.log("\n═══ BY CATEGORY (FY2025-26) ═══");
  for (const [cat, v] of Object.entries(byCat).sort((a, b) => a[1].net - b[1].net)) {
    console.log(`  ${cat.padEnd(22)} ${fmt(v.net).padStart(12)}   (${v.count})`);
  }

  // ---- Income detail (tax-critical) --------------------------------------
  console.log("\n═══ INCOME DETAIL (tax-critical) ═══");
  const income = fy.filter((t) => t.type === "income");
  const incBySub: Record<string, number> = {};
  for (const t of income) {
    const k = t.sub_category ?? "Other";
    incBySub[k] = (incBySub[k] ?? 0) + t.amount;
  }
  for (const [sub, v] of Object.entries(incBySub).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sub.padEnd(22)} ${fmt(v).padStart(12)}`);
  }

  // ---- Owner split --------------------------------------------------------
  console.log("\n═══ BY OWNER ═══");
  const byOwner: Record<string, number> = {};
  for (const t of fy) byOwner[t.owner] = (byOwner[t.owner] ?? 0) + 1;
  for (const [o, c] of Object.entries(byOwner)) console.log(`  ${o.padEnd(10)} ${c} rows`);

  // ---- Unmatched (need review) -------------------------------------------
  const unmatched = fy.filter((t) => t.method === "unmatched");
  console.log(`\n═══ UNMATCHED — need manual category: ${unmatched.length} ═══`);
  const unmMerchants: Record<string, number> = {};
  for (const t of unmatched) {
    const k = (t.merchant || t.detail).slice(0, 40);
    unmMerchants[k] = (unmMerchants[k] ?? 0) + 1;
  }
  for (const [m, c] of Object.entries(unmMerchants).sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`  ${String(c).padStart(3)}×  ${m}`);
  }

  // ---- Write categorised CSV ---------------------------------------------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outCsv = Papa.unparse(
    fy
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => ({
        date: t.date,
        amount: t.amount,
        owner: t.owner,
        institution: t.institution,
        account: t.account,
        merchant: t.merchant,
        category: t.category,
        sub_category: t.sub_category ?? "",
        type: t.type,
        method: t.method,
        detail: t.detail,
      }))
  );
  const outPath = path.join(OUT_DIR, "apr-jun-2026-categorised.csv");
  fs.writeFileSync(outPath, outCsv);
  console.log(`\nWrote categorised ledger → ${path.relative(process.cwd(), outPath)}`);

  const matchRate = (((fy.length - unmatched.length) / fy.length) * 100).toFixed(1);
  console.log(`Auto-categorisation match rate: ${matchRate}%`);
}

main();
