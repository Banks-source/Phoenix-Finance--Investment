import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Authoritative Ashby rent from BEYOND PROPERTY (from the user's CSV).
const CSV = [
  ["2025-08-28", 2475.0],
  ["2025-09-29", 2475.0],
  ["2025-10-27", 2475.0],
  ["2025-11-27", 2475.0],
  ["2025-12-31", 2475.0],
  ["2026-03-02", 2475.0],
  ["2026-04-01", 2475.0],
  ["2026-04-27", 2475.0],
  ["2026-05-28", 2475.0],
] as [string, number][];

async function main() {
  const { data } = await db
    .from("transactions")
    .select("id, date, owner, amount, sub_category, category, type, status, source, detail")
    .ilike("detail", "%BEYOND PROPERTY%")
    .order("date");
  const rows = (data ?? []) as any[];
  console.log(`DB rows matching "BEYOND PROPERTY": ${rows.length}`);
  let dbTotal = 0;
  for (const r of rows) {
    dbTotal += Number(r.amount);
    console.log(
      `  ${r.date}  ${Number(r.amount).toFixed(2).padStart(9)}  ${String(r.owner).padEnd(7)} ${String(r.type).padEnd(8)} ${String(r.sub_category ?? "").padEnd(14)} ${r.status.padEnd(9)} ${r.source}`
    );
  }
  console.log(`  DB total: $${dbTotal.toFixed(2)}`);

  const csvTotal = CSV.reduce((s, [, a]) => s + a, 0);
  console.log(`\nCSV (authoritative) rent payments: ${CSV.length}, total $${csvTotal.toFixed(2)}`);

  // Match by date.
  const dbByDate = new Map<string, any[]>();
  for (const r of rows) (dbByDate.get(r.date) ?? dbByDate.set(r.date, []).get(r.date)!).push(r);
  console.log("\nReconciliation by CSV date:");
  for (const [d, amt] of CSV) {
    const hit = (dbByDate.get(d) ?? []).find((r) => Math.abs(Number(r.amount) - amt) < 0.01);
    const near = dbByDate.get(d) ?? [];
    if (hit) console.log(`  ${d}  $${amt.toFixed(2)}  OK`);
    else if (near.length) console.log(`  ${d}  $${amt.toFixed(2)}  MISMATCH — DB has ${near.map((r) => `$${Number(r.amount).toFixed(2)}`).join(", ")}`);
    else console.log(`  ${d}  $${amt.toFixed(2)}  MISSING in DB`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
