import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ATO tax refunds are not assessable income. Move them out of income into
// Transfers (excluded from income + expense/deficit totals).
async function main() {
  const { data } = await db
    .from("transactions")
    .select("id, date, amount, detail, merchant")
    .eq("type", "income")
    .limit(2000);

  const targets = (data ?? []).filter((r) =>
    /ATO REFUND|TAX REFUND/i.test(`${r.detail ?? ""} ${r.merchant ?? ""}`)
  );

  console.log(`Found ${targets.length} ATO-refund rows currently typed as income:`);
  for (const r of targets) {
    console.log(`  ${r.date}  $${Number(r.amount).toFixed(0)}  ${(r.merchant || r.detail || "").slice(0, 50)}`);
  }

  if (targets.length === 0) return;

  const { error } = await db
    .from("transactions")
    .update({ category: "Money Movement", type: "transfers", sub_category: "ATO Refund" })
    .in("id", targets.map((r) => r.id));

  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }
  const total = targets.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`\nReclassified ${targets.length} rows ($${total.toFixed(0)}) → Transfers / ATO Refund.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
