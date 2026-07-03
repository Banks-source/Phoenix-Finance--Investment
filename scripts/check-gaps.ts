import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function fetchAll(build: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function main() {
  // All transactions in FY25-26, any status/source.
  const rows = await fetchAll((from, to) =>
    db.from("transactions")
      .select("date, owner, source, status, type, merchant, amount")
      .gte("date", "2025-07-01").lte("date", "2026-06-30")
      .order("date").range(from, to)
  );
  console.log(`Total FY25-26 rows: ${rows.length}`);

  // Count by year-month + source.
  const byMonth = new Map<string, { n: number; sources: Record<string, number> }>();
  for (const r of rows) {
    const ym = String(r.date).slice(0, 7);
    const e = byMonth.get(ym) ?? { n: 0, sources: {} };
    e.n++;
    e.sources[r.source] = (e.sources[r.source] ?? 0) + 1;
    byMonth.set(ym, e);
  }
  console.log("\nBy month (count · sources):");
  [...byMonth.entries()].sort().forEach(([ym, e]) =>
    console.log(`  ${ym}  ${String(e.n).padStart(4)}   ${Object.entries(e.sources).map(([s, c]) => `${s}:${c}`).join("  ")}`)
  );

  // IAG salary cadence.
  const iag = rows.filter((r) => r.type === "income" && r.merchant === "IAG").sort((a, b) => a.date.localeCompare(b.date));
  console.log("\nIAG salary rows (merchant=IAG):");
  let prev: Date | null = null;
  for (const r of iag) {
    const d = new Date(r.date);
    const gap = prev ? Math.round((d.getTime() - prev.getTime()) / 86400000) : 0;
    console.log(`  ${r.date}  ${Number(r.amount).toFixed(2).padStart(11)}  gap=${gap}d ${gap > 15 ? "  <-- GAP" : ""}`);
    prev = d;
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
