import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { execSync } from "child_process";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function page<T>(sel: string): Promise<T[]> {
  const out: any[] = []; let from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await db.from("transactions").select(sel).range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return out;
}

async function main() {
  // Workbook side (source of truth).
  const wb = JSON.parse(execSync("python3 scripts/workbook_totals.py").toString());

  // DB side.
  const rows = await page<{ date: string; amount: number }>("date, amount");
  const dbCount: Record<string, number> = {};
  const dbSum: Record<string, number> = {};
  let gN = 0, gS = 0;
  for (const r of rows) {
    const y = r.date.slice(0, 4);
    dbCount[y] = (dbCount[y] ?? 0) + 1;
    dbSum[y] = (dbSum[y] ?? 0) + Number(r.amount);
    gN++; gS += Number(r.amount);
  }

  const years = Object.keys(wb.by_year).sort();
  console.log("Year   Workbook rows / sum          DB rows / sum               Match");
  let allOk = true;
  for (const y of years) {
    const w = wb.by_year[y];
    const dc = dbCount[y] ?? 0;
    const ds = Math.round((dbSum[y] ?? 0) * 100) / 100;
    const ok = w.count === dc && Math.abs(w.sum - ds) < 0.01;
    allOk = allOk && ok;
    console.log(
      `${y}   ${String(w.count).padStart(5)} / ${String(w.sum).padStart(12)}      ${String(dc).padStart(5)} / ${String(ds.toFixed(2)).padStart(12)}      ${ok ? "✓" : "✗ MISMATCH"}`
    );
  }
  const gsr = Math.round(gS * 100) / 100;
  const gOk = wb.grand.count === gN && Math.abs(wb.grand.sum - gsr) < 0.01;
  console.log(`\nTOTAL  ${String(wb.grand.count).padStart(5)} / ${String(wb.grand.sum).padStart(12)}      ${String(gN).padStart(5)} / ${String(gsr.toFixed(2)).padStart(12)}      ${gOk ? "✓" : "✗"}`);
  console.log(allOk && gOk ? "\n✅ DB matches source workbooks exactly (counts + sums, to the cent)." : "\n⚠️  Discrepancies found.");
}
main().catch((e) => { console.error(e); process.exit(1); });
