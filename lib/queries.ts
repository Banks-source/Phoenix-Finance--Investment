import { createServiceClient } from "@/lib/supabase/server";
import { PeriodFilter, periodBounds, periodsFromDates } from "@/lib/fy";
import { TxnType } from "@/lib/taxonomy";

type AnyClient = ReturnType<typeof createServiceClient>;

// PostgREST caps every response at `max-rows` (1000 by default), so any query
// that needs the full result set must page through it explicitly. Applies the
// same builder for each page via a factory.
async function fetchAll<T>(build: (c: AnyClient) => any): Promise<T[]> {
  const supabase = createServiceClient();
  const out: T[] = [];
  const size = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await build(supabase).range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return out;
}

export interface Txn {
  id: string;
  date: string;
  amount: number;
  owner: string;
  transaction_type: string | null;
  detail: string | null;
  merchant: string | null;
  category: string | null;
  sub_category: string | null;
  type: TxnType;
  status: string;
  source: string;
  confidence: number | null;
}

/** Distinct dates across the whole store — used to build the period dropdown. */
export async function getAvailablePeriods() {
  const rows = await fetchAll<{ date: string }>((c) =>
    c.from("transactions").select("date").order("date", { ascending: false })
  );
  return periodsFromDates(rows.map((r) => r.date));
}

export interface FetchOpts {
  period?: PeriodFilter;
  status?: string;
  search?: string;
  owner?: string;
  type?: string;
  category?: string;
  sub_category?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTransactions(opts: FetchOpts = {}) {
  const supabase = createServiceClient();
  let q = supabase.from("transactions").select("*", { count: "exact" });

  if (opts.period) {
    const b = periodBounds(opts.period);
    if (b) q = q.gte("date", b[0]).lte("date", b[1]);
  }
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.owner) q = q.eq("owner", opts.owner);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.search) q = q.or(`detail.ilike.%${opts.search}%,merchant.ilike.%${opts.search}%`);

  q = q.order("date", { ascending: false });
  if (opts.limit != null) q = q.range(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit - 1);

  const { data, count } = await q;
  return { rows: (data ?? []) as Txn[], count: count ?? 0 };
}

/** Every matching transaction (paged past the 1000-row cap) — for exports/tax. */
export async function fetchAllTransactions(opts: Omit<FetchOpts, "limit" | "offset"> = {}) {
  const b = opts.period ? periodBounds(opts.period) : null;
  const rows = await fetchAll<Txn>((c) => {
    let q = c.from("transactions").select("*");
    if (b) q = q.gte("date", b[0]).lte("date", b[1]);
    if (opts.status) q = q.eq("status", opts.status);
    if (opts.owner) q = q.eq("owner", opts.owner);
    if (opts.type) q = q.eq("type", opts.type);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.sub_category) q = q.eq("sub_category", opts.sub_category);
    if (opts.search) q = q.or(`detail.ilike.%${opts.search}%,merchant.ilike.%${opts.search}%`);
    return q.order("date", { ascending: false });
  });
  return { rows, count: rows.length };
}

/** Aggregate totals by taxonomy type for a period (for stat cards / overview). */
export async function fetchTypeTotals(period?: PeriodFilter) {
  const b = period ? periodBounds(period) : null;
  const rows = await fetchAll<{ type: string; amount: number }>((c) => {
    let q = c.from("transactions").select("type, amount").eq("status", "approved");
    if (b) q = q.gte("date", b[0]).lte("date", b[1]);
    return q;
  });
  const totals: Record<string, number> = {};
  for (const r of rows) {
    totals[r.type] = (totals[r.type] ?? 0) + Number(r.amount);
  }
  return totals;
}

/** Net by category for a period. */
export async function fetchCategoryTotals(period?: PeriodFilter) {
  const b = period ? periodBounds(period) : null;
  const rows = await fetchAll<{ category: string | null; type: string; amount: number }>((c) => {
    let q = c.from("transactions").select("category, type, amount").eq("status", "approved");
    if (b) q = q.gte("date", b[0]).lte("date", b[1]);
    return q;
  });
  const map = new Map<string, { category: string; type: string; net: number; count: number }>();
  for (const r of rows) {
    const key = r.category ?? "Uncategorised";
    const e = map.get(key) ?? { category: key, type: r.type, net: 0, count: 0 };
    e.net += Number(r.amount);
    e.count += 1;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => a.net - b.net);
}

/** Net by sub-category for a given transaction type in a period (e.g. income sources). */
export async function fetchSubCategoryTotals(type: string, period?: PeriodFilter) {
  const b = period ? periodBounds(period) : null;
  const rows = await fetchAll<{ sub_category: string | null; amount: number }>((c) => {
    let q = c.from("transactions").select("sub_category, amount").eq("status", "approved").eq("type", type);
    if (b) q = q.gte("date", b[0]).lte("date", b[1]);
    return q;
  });
  const map = new Map<string, { name: string; net: number; count: number }>();
  for (const r of rows) {
    const key = r.sub_category ?? "Other";
    const e = map.get(key) ?? { name: key, net: 0, count: 0 };
    e.net += Number(r.amount);
    e.count += 1;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}
