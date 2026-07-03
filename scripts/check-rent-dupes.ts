import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  // Any milani credit of exactly 2475 across the FY, any detail.
  const { data } = await db
    .from("transactions")
    .select("date, owner, amount, sub_category, detail, source")
    .eq("amount", 2475)
    .gte("date", "2025-07-01").lte("date", "2026-06-30")
    .order("date");
  console.log("All $2,475 credits in FY25-26 (any owner/detail):");
  for (const r of (data ?? []) as any[]) {
    console.log(`  ${r.date}  ${String(r.owner).padEnd(7)} ${r.sub_category ?? ""} | ${r.detail ?? ""} [${r.source}]`);
  }

  // Milani credits in the 5 "missing" months, 2000-3000, to spot anything rent-like.
  for (const [from, to] of [["2025-08-01","2025-08-31"],["2025-09-01","2025-09-30"],["2025-10-01","2025-10-31"],["2025-11-01","2025-11-30"],["2025-12-01","2025-12-31"]] as [string,string][]) {
    const { data: d2 } = await db
      .from("transactions")
      .select("date, amount, detail")
      .eq("owner", "milani")
      .gte("date", from).lte("date", to)
      .gte("amount", 2000).lte("amount", 3000)
      .order("date");
    console.log(`\n  ${from.slice(0,7)} milani credits 2k-3k:`);
    for (const r of (d2 ?? []) as any[]) console.log(`     ${r.date}  ${Number(r.amount).toFixed(2)}  ${r.detail ?? ""}`);
    if (!(d2 ?? []).length) console.log("     (none)");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
