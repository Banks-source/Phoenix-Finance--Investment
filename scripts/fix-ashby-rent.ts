import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const DETAIL = "Fast Transfer From BEYOND PROPERTY ENTER Rent Disbursement";
const MISSING: string[] = ["2025-08-28", "2025-09-29", "2025-10-27", "2025-11-27", "2025-12-31"];

async function main() {
  // 1) Fix the wrong-amount rent on 2 Mar 2026: $1,200 -> $2,475.
  {
    const { data, error } = await db
      .from("transactions")
      .update({ amount: 2475.0 })
      .eq("date", "2026-03-02").eq("amount", 1200).ilike("detail", "%BEYOND PROPERTY%")
      .select("id");
    if (error) throw error;
    console.log(`1) 2026-03-02 amount $1,200 -> $2,475: ${data?.length ?? 0} row(s)`);
  }

  // 2) Remove the two spurious $1,200 rows on 2 Jan / 2 Feb 2026 (not in the
  //    authoritative CSV — the property had no Jan/Feb disbursement).
  {
    const { data, error } = await db
      .from("transactions")
      .delete()
      .in("date", ["2026-01-02", "2026-02-02"]).eq("amount", 1200).ilike("detail", "%BEYOND PROPERTY%")
      .select("id, date");
    if (error) throw error;
    console.log(`2) Deleted spurious $1,200 rows: ${(data ?? []).map((r: any) => r.date).join(", ") || "none"}`);
  }

  // 3) Insert the five missing $2,475 rent payments (Aug–Dec 2025).
  for (const date of MISSING) {
    const { data: existing } = await db
      .from("transactions")
      .select("id").eq("date", date).eq("amount", 2475).ilike("detail", "%BEYOND PROPERTY%").maybeSingle();
    if (existing) { console.log(`3) ${date} already present — skipped`); continue; }
    const { error } = await db.from("transactions").insert({
      date,
      amount: 2475.0,
      owner: "milani",
      detail: DETAIL,
      merchant: null,
      category: "Income",
      sub_category: "Rent received",
      type: "income",
      status: "approved",
      confidence: 1.0,
      source: "manual",
    });
    if (error) throw error;
    console.log(`3) Inserted ${date}  $2,475.00  Rent received (manual)`);
  }

  // Verify total.
  const { data } = await db
    .from("transactions")
    .select("date, amount")
    .ilike("detail", "%BEYOND PROPERTY%")
    .gte("date", "2025-07-01").lte("date", "2026-06-30")
    .order("date");
  const total = (data ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
  console.log(`\nAshby rent now: ${(data ?? []).length} payments, $${total.toFixed(2)}`);
  for (const r of (data ?? []) as any[]) console.log(`  ${r.date}  $${Number(r.amount).toFixed(2)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
