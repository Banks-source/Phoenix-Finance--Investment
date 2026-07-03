import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function page<T>(sel: string, apply: (q: any) => any = (q) => q): Promise<T[]> {
  const out: any[] = []; let from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await apply(db.from("transactions").select(sel)).range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return out;
}

async function main() {
  const rows = await page<{ source: string; status: string; created_at: string; date: string }>("source, status, created_at, date");
  const bySrcStatus = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.source} | ${r.status}`;
    bySrcStatus.set(k, (bySrcStatus.get(k) ?? 0) + 1);
  }
  console.log("=== source | status counts ===");
  [...bySrcStatus.entries()].sort().forEach(([k, v]) => console.log(`${String(v).padStart(6)}  ${k}`));

  // bank_import rows that are now approved = candidate accidental approvals.
  const bankApproved = rows.filter((r) => r.source === "bank_import" && r.status === "approved");
  console.log(`\nbank_import + approved: ${bankApproved.length}`);
  if (bankApproved.length) {
    const dates = bankApproved.map((r) => r.date).sort();
    const created = bankApproved.map((r) => r.created_at).sort();
    console.log(`  txn date range:    ${dates[0]} → ${dates[dates.length - 1]}`);
    console.log(`  created_at range:  ${created[0]} → ${created[created.length - 1]}`);
    // group created_at by minute to spot the bulk action
    const byMin = new Map<string, number>();
    for (const c of created) { const m = c.slice(0, 16); byMin.set(m, (byMin.get(m) ?? 0) + 1); }
    console.log("  created_at by minute:");
    [...byMin.entries()].sort().forEach(([k, v]) => console.log(`    ${k}  ${v}`));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
