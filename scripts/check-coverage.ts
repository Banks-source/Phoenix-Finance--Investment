import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function page<T>(sel: string, build: (q: any) => any = (q) => q): Promise<T[]> {
  const out: any[] = []; let from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await build(db.from("transactions").select(sel)).range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
    from += size;
  }
  return out;
}

async function main() {
  const all = await page<{ date: string; status: string }>("date, status");
  const dates = all.map((r) => r.date).sort();
  console.log("date range:", dates[0], "→", dates[dates.length - 1]);

  // Monthly counts for 2026
  const m2026 = new Map<string, number>();
  for (const r of all) if (r.date >= "2026-01-01") m2026.set(r.date.slice(0, 7), (m2026.get(r.date.slice(0, 7)) ?? 0) + 1);
  console.log("2026 by month:", [...m2026.entries()].sort());

  // Pending rows detail
  const pending = await page<{ date: string; source: string }>("date, source", (q) => q.eq("status", "pending_review"));
  console.log("\npending_review:", pending.length);
  const bySource = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const r of pending) {
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
    byMonth.set(r.date.slice(0, 7), (byMonth.get(r.date.slice(0, 7)) ?? 0) + 1);
  }
  console.log("  by source:", [...bySource.entries()]);
  console.log("  by month:", [...byMonth.entries()].sort());
}
main().catch((e) => { console.error(e); process.exit(1); });
