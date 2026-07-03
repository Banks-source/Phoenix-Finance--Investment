import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const SUBS = process.argv.slice(2);
if (!SUBS.length) SUBS.push("Lloyd", "Milani");

async function main() {
  for (const sub of SUBS) {
    const { data } = await db
      .from("transactions")
      .select("date, owner, merchant, detail, amount")
      .eq("type", "income")
      .eq("status", "approved")
      .eq("sub_category", sub)
      .gte("date", "2025-07-01")
      .lte("date", "2026-06-30")
      .order("date");
    const rows = data ?? [];
    const total = rows.reduce((s, r: any) => s + Number(r.amount), 0);
    console.log(`\n=== sub_category "${sub}" — ${rows.length} txns, $${total.toFixed(2)} ===`);
    for (const r of rows as any[]) {
      console.log(
        `  ${r.date}  ${String(r.owner).padEnd(7)} ${Number(r.amount).toFixed(2).padStart(11)}  ${r.merchant ?? ""} | ${r.detail ?? ""}`
      );
    }
    // Distinct merchants
    const byMerchant = new Map<string, { net: number; count: number }>();
    for (const r of rows as any[]) {
      const k = r.merchant ?? "«no merchant»";
      const e = byMerchant.get(k) ?? { net: 0, count: 0 };
      e.net += Number(r.amount); e.count++;
      byMerchant.set(k, e);
    }
    console.log(`  -- distinct merchants:`);
    [...byMerchant.entries()].sort((a, b) => b[1].net - a[1].net).forEach(([k, v]) =>
      console.log(`     ${v.net.toFixed(2).padStart(11)}  ${String(v.count).padStart(3)}  ${k}`)
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
