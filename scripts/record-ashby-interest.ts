import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// ING investment-loan (Ashby) costs, FY2025-26 — from the ING statement + CSV.
// Recorded as isolated property items (category Investment / type transfers) so
// they DON'T distort the household spending breakdown, but are tagged via
// sub_category for the rental schedule.
const INTEREST: [string, number][] = [
  ["2025-07-31", 2975.87],
  ["2025-08-31", 2954.60],
  ["2025-09-30", 2764.30],
  ["2025-10-31", 2854.09],
  ["2025-11-30", 2764.33],
  ["2025-12-31", 2856.71],
  ["2026-01-31", 2857.04],
  ["2026-02-28", 2655.87],
  ["2026-03-31", 3000.01],
  ["2026-04-30", 3000.50],
  ["2026-05-31", 3167.33],
  ["2026-06-30", 3120.04],
];
const FEES: [string, number, string][] = [
  ["2025-12-21", 299.0, "ING Orange Advantage annual fee"],
  ["2026-01-06", 30.0, "ING loan late payment fee"],
];

function row(date: string, amount: number, sub: string, detail: string) {
  return {
    date,
    amount: -Math.abs(amount), // expense
    owner: "lloyd",
    detail,
    merchant: "ING",
    category: "Investment",
    sub_category: sub,
    type: "transfers",
    status: "approved",
    confidence: 1.0,
    source: "manual",
  };
}

async function main() {
  let added = 0;
  for (const [date, amt] of INTEREST) {
    const { data: dupe } = await db.from("transactions").select("id")
      .eq("date", date).eq("owner", "lloyd").eq("merchant", "ING").eq("sub_category", "Ashby loan interest").maybeSingle();
    if (dupe) { console.log(`  ${date} interest already present — skipped`); continue; }
    const { error } = await db.from("transactions").insert(row(date, amt, "Ashby loan interest", `Interest Charge — Ashby INV loan 200411638`));
    if (error) throw error;
    added++;
  }
  for (const [date, amt, detail] of FEES) {
    const { data: dupe } = await db.from("transactions").select("id")
      .eq("date", date).eq("owner", "lloyd").eq("merchant", "ING").eq("sub_category", "Ashby loan fees").maybeSingle();
    if (dupe) { console.log(`  ${date} fee already present — skipped`); continue; }
    const { error } = await db.from("transactions").insert(row(date, amt, "Ashby loan fees", detail));
    if (error) throw error;
    added++;
  }
  console.log(`Inserted ${added} ING loan cost rows.`);

  // Verify totals.
  const { data } = await db.from("transactions").select("sub_category, amount")
    .eq("merchant", "ING").eq("owner", "lloyd")
    .gte("date", "2025-07-01").lte("date", "2026-06-30");
  const byS = new Map<string, number>();
  for (const r of (data ?? []) as any[]) byS.set(r.sub_category, (byS.get(r.sub_category) ?? 0) + Number(r.amount));
  console.log("\nAshby loan costs recorded (FY25-26):");
  for (const [s, v] of byS) console.log(`  ${s}: $${Math.abs(v).toFixed(2)}`);
  const total = [...byS.values()].reduce((s, v) => s + v, 0);
  console.log(`  TOTAL deductible loan costs: $${Math.abs(total).toFixed(2)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
