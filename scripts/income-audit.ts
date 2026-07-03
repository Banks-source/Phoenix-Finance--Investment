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

// FY2025-26 = 1 Jul 2025 → 30 Jun 2026
const START = "2025-07-01";
const END = "2026-06-30";

async function main() {
  const { data } = await db
    .from("transactions")
    .select("date, amount, owner, detail, merchant")
    .eq("type", "income")
    .gte("date", START)
    .lte("date", END)
    .order("amount", { ascending: false })
    .limit(1000);

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  console.log(`FY25-26 income rows: ${rows.length}, total $${total.toFixed(2)}\n`);

  // Flag likely non-assessable items.
  const flag = (r: any) => {
    const t = `${r.detail ?? ""} ${r.merchant ?? ""}`.toUpperCase();
    if (/ATO REFUND|TAX REFUND/.test(t)) return "ATO-REFUND";
    if (/LINKED ACC|OWN ACC|TRANSFER FROM|INTERNAL/.test(t)) return "TRANSFER?";
    if (/REFUND|REVERSAL/.test(t)) return "REFUND?";
    return "";
  };

  let flagged = 0;
  console.log("date        owner    amount       flag        detail");
  for (const r of rows) {
    const f = flag(r);
    if (f) flagged += Number(r.amount);
    console.log(
      `${r.date}  ${String(r.owner).padEnd(7)}  ${String(Number(r.amount).toFixed(0)).padStart(9)}  ${f.padEnd(11)}  ${(r.merchant || r.detail || "").slice(0, 50)}`
    );
  }
  console.log(`\nFlagged (likely NOT assessable): $${flagged.toFixed(0)}`);
  console.log(`Remaining assessable estimate: $${(total - flagged).toFixed(0)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
