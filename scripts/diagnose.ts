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

async function page<T>(sel: string): Promise<T[]> {
  const out: any[] = [];
  let from = 0;
  const size = 1000;
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
  const rows = await page<{ date: string; amount: number; type: string; status: string; category: string | null; source: string }>(
    "date, amount, type, status, category, source"
  );
  console.log("TOTAL rows:", rows.length);

  const by = (key: (r: any) => string) => {
    const m = new Map<string, { n: number; sum: number }>();
    for (const r of rows) {
      const k = key(r);
      const e = m.get(k) ?? { n: 0, sum: 0 };
      e.n++;
      e.sum += Number(r.amount);
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  };

  console.log("\n== by type ==");
  for (const [k, v] of by((r) => r.type)) console.log(k.padEnd(22), v.n, "  $" + v.sum.toFixed(0));

  console.log("\n== by status ==");
  for (const [k, v] of by((r) => r.status)) console.log(k.padEnd(22), v.n, "  $" + v.sum.toFixed(0));

  console.log("\n== by source ==");
  for (const [k, v] of by((r) => r.source)) console.log(k.padEnd(22), v.n, "  $" + v.sum.toFixed(0));

  console.log("\n== by year ==");
  for (const [k, v] of by((r) => (r.date || "?").slice(0, 4)).sort()) console.log(k, v.n, "  $" + v.sum.toFixed(0));

  console.log("\n== income category rows ==");
  const inc = rows.filter((r) => r.category === "Income");
  console.log("category=Income:", inc.length, "sum $" + inc.reduce((s, r) => s + Number(r.amount), 0).toFixed(0));
  const incType = rows.filter((r) => r.type === "income");
  console.log("type=income:", incType.length, "sum $" + incType.reduce((s, r) => s + Number(r.amount), 0).toFixed(0));

  console.log("\n== positive-amount rows (money in) ==");
  const pos = rows.filter((r) => Number(r.amount) > 0);
  console.log("count:", pos.length, "sum $" + pos.reduce((s, r) => s + Number(r.amount), 0).toFixed(0));
  const posByType = new Map<string, number>();
  for (const r of pos) posByType.set(r.type, (posByType.get(r.type) ?? 0) + 1);
  console.log("positive rows by type:", [...posByType.entries()]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
