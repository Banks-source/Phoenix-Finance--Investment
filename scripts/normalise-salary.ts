import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const norm = (m: string) => m.trim().toUpperCase().replace(/\s+/g, " ");

// Relabel by exact merchant so we only touch genuine wage rows.
// The 2025-12-31 "ONLINE Y Linked Acc Trns THOMAS L" transfer is deliberately
// NOT matched here — it stays under "Lloyd" for manual review.
const JOBS: { label: string; merchants: string[] }[] = [
  { label: "IAG salary", merchants: ["IAG"] },
  { label: "Myer salary", merchants: ["Myer"] },
];

async function main() {
  for (const job of JOBS) {
    for (const merchant of job.merchants) {
      const { data, error } = await db
        .from("transactions")
        .update({ sub_category: job.label })
        .eq("type", "income")
        .eq("status", "approved")
        .eq("merchant", merchant)
        .gte("date", "2025-07-01")
        .lte("date", "2026-06-30")
        .select("id");
      if (error) { console.error(error); process.exit(1); }
      console.log(`  "${merchant}" -> "${job.label}": ${data?.length ?? 0} rows`);

      // Remember the rule so future imports auto-tag it.
      const pattern = norm(merchant);
      const { data: ex } = await db
        .from("merchant_rules")
        .select("match_count")
        .eq("merchant_pattern", pattern)
        .maybeSingle();
      await db.from("merchant_rules").upsert(
        {
          merchant_pattern: pattern,
          category: "Income",
          sub_category: job.label,
          type: "income",
          match_count: ((ex as any)?.match_count ?? 0) + 1,
          last_used: new Date().toISOString(),
        },
        { onConflict: "merchant_pattern" }
      );
    }
  }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
