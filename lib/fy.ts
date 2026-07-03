// Australian financial-year helpers. AU FY runs 1 July → 30 June and is named
// by the calendar year it ends in (e.g. "FY2026" = 1 Jul 2025 → 30 Jun 2026).
import { TxnType } from "./taxonomy";

export interface FYRange {
  fyEndYear: number; // 2026 for FY2025-26
  label: string; // "FY25-26"
  start: string; // ISO
  end: string; // ISO
}

/** The FY that a given ISO date falls into (by end year). */
export function fyEndYearForDate(isoDate: string): number {
  const [y, m] = isoDate.split("-").map(Number);
  return m >= 7 ? y + 1 : y;
}

export function fyRange(fyEndYear: number): FYRange {
  return {
    fyEndYear,
    label: fyLabel(fyEndYear),
    start: `${fyEndYear - 1}-07-01`,
    end: `${fyEndYear}-06-30`,
  };
}

/** "FY25-26" */
export function fyLabel(fyEndYear: number): string {
  const a = String(fyEndYear - 1).slice(2);
  const b = String(fyEndYear).slice(2);
  return `FY${a}-${b}`;
}

/** Build the list of periods to offer in filters, given the data's date span. */
export function periodsFromDates(dates: string[]): {
  years: number[];
  fys: number[];
} {
  const years = new Set<number>();
  const fys = new Set<number>();
  for (const d of dates) {
    if (!d) continue;
    years.add(Number(d.slice(0, 4)));
    fys.add(fyEndYearForDate(d));
  }
  return {
    years: [...years].sort((a, b) => b - a),
    fys: [...fys].sort((a, b) => b - a),
  };
}

export interface PeriodFilter {
  kind: "all" | "year" | "fy";
  value?: number;
}

export function parsePeriod(sp: { period?: string; value?: string }): PeriodFilter {
  if (sp.period === "year" && sp.value) return { kind: "year", value: Number(sp.value) };
  if (sp.period === "fy" && sp.value) return { kind: "fy", value: Number(sp.value) };
  return { kind: "all" };
}

/** [startISO, endISO] date bounds for a period filter, or null for "all". */
export function periodBounds(p: PeriodFilter): [string, string] | null {
  if (p.kind === "year" && p.value) return [`${p.value}-01-01`, `${p.value}-12-31`];
  if (p.kind === "fy" && p.value) {
    const r = fyRange(p.value);
    return [r.start, r.end];
  }
  return null;
}

export function periodLabel(p: PeriodFilter): string {
  if (p.kind === "year") return String(p.value);
  if (p.kind === "fy") return fyLabel(p.value!);
  return "All time";
}

// Expense types that count toward the deficit / spend totals (excludes
// Transfers and Income — the core taxonomy fix from PRD §7).
export const EXPENSE_TYPES: TxnType[] = ["spending", "bills_fixed", "debt"];
