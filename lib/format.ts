import { TxnType, TYPE_LABELS } from "./taxonomy";

export function money(n: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
  if (opts.sign) return `${n < 0 ? "-" : "+"}${s}`;
  return n < 0 ? `-${s}` : s;
}

export const TYPE_COLORS: Record<TxnType, string> = {
  spending: "#e11d48",
  bills_fixed: "#f59e0b",
  transfers: "#3b82f6",
  debt: "#8b5cf6",
  income: "#059669",
  needs_categorisation: "#94a3b8",
};

export const TYPE_BADGE: Record<TxnType, string> = {
  spending: "bg-rose-50 text-rose-700 ring-rose-600/10",
  bills_fixed: "bg-amber-50 text-amber-700 ring-amber-600/10",
  transfers: "bg-blue-50 text-blue-700 ring-blue-600/10",
  debt: "bg-violet-50 text-violet-700 ring-violet-600/10",
  income: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  needs_categorisation: "bg-gray-100 text-gray-600 ring-gray-500/10",
};

export function typeLabel(t: string): string {
  return TYPE_LABELS[t as TxnType] ?? t;
}
