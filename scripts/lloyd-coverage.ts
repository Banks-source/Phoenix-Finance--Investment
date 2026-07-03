import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data } = await db
    .from("transactions")
    .select("date, amount, detail")
    .eq("owner", "lloyd")
    .gte("date", "2025-11-01").lte("date", "2025-12-31")
    .order("date");
  const rows = (data ?? []) as any[];
  // Count per day.
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + 1);
  console.log("Lloyd transactions per day, Nov–Dec 2025:");
  // Print every calendar day so gaps are visible.
  const start = new Date("2025-11-01"), end = new Date("2025-12-31");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const n = byDay.get(iso) ?? 0;
    const bar = "#".repeat(n);
    console.log(`  ${iso}  ${String(n).padStart(2)} ${bar}${n === 0 ? " (none)" : ""}`);
  }
  console.log(`\nTotal Lloyd Nov–Dec rows: ${rows.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
