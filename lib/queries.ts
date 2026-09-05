import { createServiceClient } from "@/lib/supabase/server";
import { PeriodFilter, periodBounds, periodsFromDates, fyRange, fyEndYearForDate } from "@/lib/fy";
import { TxnType } from "@/lib/taxonomy";
import { CLAIM_CANDIDATE_CATEGORIES, categoryIsDeductibleLens } from "@/lib/taxcats";

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
  deductible?: boolean | null;
  tax_category?: string | null;
  tax_note?: string | null;
  entity_id?: string | null;
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
  tax_category?: string;
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
  if (opts.tax_category) q = q.eq("tax_category", opts.tax_category);
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

export interface CategoryMonthlyTrend {
  /** Categories with any spend in the period, sorted by total (desc). */
  categories: string[];
  /** One point per month; each category present as a numeric key alongside `month`. */
  series: ({ month: string } & Record<string, number | string>)[];
}

/**
 * Monthly spend by category for a period (excludes Income/Transfers, same as
 * every other spend total in the app). Returns every category with any spend
 * — the Overview trend chart picks its own top N and lets the rest be added.
 */
export async function fetchCategoryMonthlyTrend(period?: PeriodFilter): Promise<CategoryMonthlyTrend> {
  const b = period ? periodBounds(period) : null;
  const rows = await fetchAll<{ date: string; category: string | null; type: string; amount: number }>((c) => {
    let q = c.from("transactions").select("date, category, type, amount").eq("status", "approved");
    if (b) q = q.gte("date", b[0]).lte("date", b[1]);
    return q;
  });

  const byMonth = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.category || r.type === "income" || r.type === "transfers") continue;
    const month = r.date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const m = byMonth.get(month)!;
    const abs = Math.abs(Number(r.amount));
    m.set(r.category, (m.get(r.category) ?? 0) + abs);
    totals.set(r.category, (totals.get(r.category) ?? 0) + abs);
  }

  const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const months = [...byMonth.keys()].sort();
  const series = months.map((month) => {
    const point: { month: string } & Record<string, number | string> = { month };
    const m = byMonth.get(month)!;
    for (const cat of categories) point[cat] = m.get(cat) ?? 0;
    return point;
  });

  return { categories, series };
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

// ---------------------------------------------------------------------------
// Tax (v2) — FY claims builder + year-over-year comparison
// ---------------------------------------------------------------------------

/**
 * Expense transactions in a period that are candidates for a tax deduction:
 * either the internal category hints at a claim, or the row has already been
 * touched by tax review (deductible set, or a tax_category assigned). Income
 * and transfers are excluded — claims are expenses. Pass `all` to include every
 * approved expense regardless of suggestion.
 */
export async function fetchClaimCandidates(
  period: PeriodFilter,
  opts: { owner?: string; all?: boolean } = {}
) {
  const { rows } = await fetchAllTransactions({ period, status: "approved", owner: opts.owner });
  return rows.filter((r) => {
    if (r.type === "income" || r.type === "transfers") return false;
    if (opts.all) return true;
    if (r.deductible != null || r.tax_category) return true;
    return CLAIM_CANDIDATE_CATEGORIES.has(r.category ?? "");
  });
}

export interface ClaimTotal {
  tax_category: string;
  owner: string;
  amount: number; // absolute claimed value
  count: number;
}

/** Sum of confirmed deductions (deductible=true) grouped by tax_category + owner. */
export async function fetchClaimTotals(period: PeriodFilter, owner?: string): Promise<ClaimTotal[]> {
  const b = periodBounds(period);
  let rows: { tax_category: string | null; owner: string; amount: number }[];
  try {
    rows = await fetchAll<{ tax_category: string | null; owner: string; amount: number }>((c) => {
      let q = c
        .from("transactions")
        .select("tax_category, owner, amount")
        .eq("status", "approved")
        .eq("deductible", true);
      if (b) q = q.gte("date", b[0]).lte("date", b[1]);
      if (owner) q = q.eq("owner", owner);
      return q;
    });
  } catch (e: unknown) {
    // Tax columns don't exist until migration 0002 is applied — degrade to empty
    // so the rest of the tax page (history, YoY) still renders.
    if ((e as { code?: string })?.code === "42703") return [];
    throw e;
  }
  const map = new Map<string, ClaimTotal>();
  for (const r of rows) {
    const code = r.tax_category ?? "unassigned";
    const key = `${code}::${r.owner}`;
    const e = map.get(key) ?? { tax_category: code, owner: r.owner, amount: 0, count: 0 };
    e.amount += Math.abs(Number(r.amount));
    e.count += 1;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface TaggedClaim {
  id: string;
  date: string;
  merchant: string;
  owner: string;
  tax_category: string;
  amount: number; // absolute claimed value
}

/**
 * Individual confirmed deductions (deductible=true, with a tax_category) in a
 * period — used to show the transactions LINKED to the FY estimate. Returns the
 * rows themselves (not just totals) so the history table can reveal them.
 */
export async function fetchTaggedClaims(period: PeriodFilter, owner?: string): Promise<TaggedClaim[]> {
  const b = periodBounds(period);
  try {
    const rows = await fetchAll<{
      id: string;
      date: string;
      merchant: string | null;
      detail: string | null;
      owner: string;
      tax_category: string | null;
      amount: number;
    }>((c) => {
      let q = c
        .from("transactions")
        .select("id, date, merchant, detail, owner, tax_category, amount")
        .eq("status", "approved")
        .eq("deductible", true)
        .not("tax_category", "is", null);
      if (b) q = q.gte("date", b[0]).lte("date", b[1]);
      if (owner) q = q.eq("owner", owner);
      return q.order("date", { ascending: false });
    });
    return rows
      .filter((r) => r.tax_category && r.tax_category !== "not_deductible")
      .map((r) => ({
        id: r.id,
        date: r.date,
        merchant: r.merchant || r.detail || "—",
        owner: r.owner,
        tax_category: r.tax_category as string,
        amount: Math.abs(Number(r.amount)),
      }));
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "42703") return [];
    throw e;
  }
}

export interface ClaimEstimate {
  person: string;
  fy: number;
  category: string;
  amount: number;
}

/** Manual/override FY estimates by person + category. Empty until migration 0003. */
export async function fetchClaimEstimates(fy: number): Promise<ClaimEstimate[]> {
  try {
    return await fetchAll<ClaimEstimate>((c) =>
      c.from("claim_estimates").select("person, fy, category, amount").eq("fy", fy)
    );
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    // Table missing until migration 0003 (42P01 = Postgres, PGRST205 = PostgREST cache).
    if (code === "42P01" || code === "PGRST205") return [];
    throw e;
  }
}

export interface YoyCell {
  all: number;
  lloyd: number;
  milani: number;
  joint: number;
  count: number;
}
export interface YoyRow {
  category: string;
  type: TxnType;
  deductibleLens: boolean; // category maps to a deductible tax bucket
  byFy: Record<number, YoyCell>;
}

/**
 * Net-by-category matrix across several financial years (columns), so the tax
 * hub can show this FY against prior FYs for the same categories. Fetches the
 * whole span once and buckets in memory rather than N period queries.
 */
export async function fetchCategoryYoY(fys: number[]): Promise<YoyRow[]> {
  if (fys.length === 0) return [];
  const sorted = [...fys].sort((a, b) => a - b);
  const start = fyRange(sorted[0]).start;
  const end = fyRange(sorted[sorted.length - 1]).end;
  const fySet = new Set(fys);

  const rows = await fetchAll<{ date: string; category: string | null; type: TxnType; owner: string; amount: number }>(
    (c) =>
      c
        .from("transactions")
        .select("date, category, type, owner, amount")
        .eq("status", "approved")
        .gte("date", start)
        .lte("date", end)
  );

  const empty = (): YoyCell => ({ all: 0, lloyd: 0, milani: 0, joint: 0, count: 0 });
  const map = new Map<string, YoyRow>();
  for (const r of rows) {
    const fy = fyEndYearForDate(r.date);
    if (!fySet.has(fy)) continue;
    const cat = r.category ?? "Uncategorised";
    const row =
      map.get(cat) ??
      ({ category: cat, type: r.type, deductibleLens: categoryIsDeductibleLens(cat), byFy: {} } as YoyRow);
    const cell = (row.byFy[fy] ??= empty());
    const amt = Number(r.amount);
    cell.all += amt;
    cell.count += 1;
    if (r.owner === "lloyd") cell.lloyd += amt;
    else if (r.owner === "milani") cell.milani += amt;
    else cell.joint += amt;
    map.set(cat, row);
  }

  // Sort by the most recent FY's absolute magnitude, largest first.
  const latest = sorted[sorted.length - 1];
  return [...map.values()].sort(
    (a, b) => Math.abs(b.byFy[latest]?.all ?? 0) - Math.abs(a.byFy[latest]?.all ?? 0)
  );
}
