import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const NET = 5923.39; // stable fortnightly net at that period (matches 10-22, 11-05, 12-31, 01-01)
const MISSING = ["2025-11-19", "2025-12-03", "2025-12-17"];

async function main() {
  // 1) Confirm 31 Dec linked-account credit is IAG salary (user confirmed real pay).
  {
    const { data, error } = await db
      .from("transactions")
      .update({ sub_category: "IAG salary" })
      .eq("date", "2025-12-31").eq("owner", "lloyd").eq("amount", NET).eq("sub_category", "Lloyd")
      .select("id");
    if (error) throw error;
    console.log(`1) 2025-12-31 $${NET} -> IAG salary: ${data?.length ?? 0} row(s)`);
  }

  // 2) Add the three missing fortnightly IAG pays (Nov 19, Dec 3, Dec 17).
  for (const date of MISSING) {
    const { data: dupe } = await db
      .from("transactions").select("id")
      .eq("date", date).eq("owner", "lloyd").eq("amount", NET).maybeSingle();
    if (dupe) { console.log(`2) ${date} already present — skipped`); continue; }
    const { error } = await db.from("transactions").insert({
      date,
      amount: NET,
      owner: "lloyd",
      detail: "SALARY70/121680 IAG SERVICES PTY LLOYD THOMAS",
      merchant: "IAG",
      category: "Income",
      sub_category: "IAG salary",
      type: "income",
      status: "approved",
      confidence: 1.0,
      source: "manual",
    });
    if (error) throw error;
    console.log(`2) Inserted ${date}  $${NET}  IAG salary (manual)`);
  }

  // 3) Verify Lloyd IAG net total + count.
  const { data } = await db
    .from("transactions")
    .select("date, amount")
    .eq("type", "income").eq("status", "approved").eq("sub_category", "IAG salary")
    .gte("date", "2025-07-01").lte("date", "2026-06-30")
    .order("date");
  const rows = (data ?? []) as any[];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`\nIAG salary now: ${rows.length} pays, net $${total.toFixed(2)}`);

  const gross = 286154.65, paygw = 100669.0;
  console.log(`ATO gross:        $${gross.toFixed(2)}`);
  console.log(`ATO PAYGW:        $${paygw.toFixed(2)}`);
  console.log(`ATO gross - PAYGW: $${(gross - paygw).toFixed(2)}   (expected net)`);
  console.log(`App net - expected: $${(total - (gross - paygw)).toFixed(2)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
