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
    .select("sub_category, merchant, amount")
    .eq("type", "income")
    .eq("status", "approved")
    .gte("date", "2025-07-01")
    .lte("date", "2026-06-30");
  const bySub = new Map<string, { net: number; count: number }>();
  for (const r of data ?? []) {
    const k = (r as any).sub_category ?? "«null»";
    const e = bySub.get(k) ?? { net: 0, count: 0 };
    e.net += Number((r as any).amount); e.count++;
    bySub.set(k, e);
  }
  console.log("FY25-26 income by sub_category:");
  [...bySub.entries()].sort((a, b) => b[1].net - a[1].net).forEach(([k, v]) =>
    console.log(`  ${v.net.toFixed(2).padStart(12)}  ${String(v.count).padStart(4)}  ${k}`)
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
