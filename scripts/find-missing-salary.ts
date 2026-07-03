import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  // Any lloyd credit 4,000–8,000 in Nov–Dec 2025, regardless of category.
  const { data } = await db
    .from("transactions")
    .select("date, owner, category, sub_category, type, merchant, detail, amount, status")
    .eq("owner", "lloyd")
    .gte("date", "2025-11-01").lte("date", "2026-01-15")
    .gte("amount", 4000).lte("amount", 45000)
    .order("date");
  console.log("Lloyd credits 4k–45k, 1 Nov 2025 – 15 Jan 2026:");
  for (const r of (data ?? []) as any[]) {
    console.log(
      `  ${r.date}  ${Number(r.amount).toFixed(2).padStart(11)}  ${String(r.type).padEnd(10)} ${String(r.category ?? "").padEnd(14)} ${String(r.sub_category ?? "").padEnd(14)} ${r.merchant ?? ""} | ${r.detail ?? ""}`
    );
  }

  // Also: any income at all (any owner) in Nov/Dec that isn't salary, for context.
  const { data: allNovDec } = await db
    .from("transactions")
    .select("date, owner, amount, merchant, detail")
    .gte("date", "2025-11-01").lte("date", "2025-12-31")
    .gte("amount", 3000)
    .order("date");
  console.log("\nAll credits >= 3k in Nov–Dec 2025 (any owner):");
  for (const r of (allNovDec ?? []) as any[]) {
    console.log(`  ${r.date}  ${r.owner.padEnd(7)} ${Number(r.amount).toFixed(2).padStart(11)}  ${r.merchant ?? ""} | ${r.detail ?? ""}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
