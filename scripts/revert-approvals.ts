import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  // Revert every bank_import row (the Apr–Jun 2026 batch) back to pending_review.
  const { data, error } = await db
    .from("transactions")
    .update({ status: "pending_review" })
    .eq("source", "bank_import")
    .eq("status", "approved")
    .select("id");
  if (error) throw error;
  console.log(`Reverted ${data?.length ?? 0} bank_import rows to pending_review.`);

  const { count } = await db
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review");
  console.log(`Total pending_review now: ${count}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
