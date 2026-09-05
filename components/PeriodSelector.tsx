"use client";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fyLabel } from "@/lib/fy";

const VISIBLE_COUNT = 3; // most recent 3 financial years / calendar years

// Year / Financial-Year / All-time / Custom-range selector that drives page
// filtering via URL search params (?period=fy&value=2026 or
// ?period=custom&from=2026-01-01&to=2026-03-31). `fallback` lets a page
// (e.g. Tax) show its default period when the URL has no explicit selection.
export default function PeriodSelector({
  years,
  fys,
  fallback,
}: {
  years: number[];
  fys: number[];
  fallback?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const period = sp.get("period");
  const value = sp.get("value") ?? "";
  const current = period ? `${period}:${value}` : fallback ?? "all";
  const isCustom = period === "custom";

  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [showCustom, setShowCustom] = useState(isCustom);

  const visibleFys = fys.slice(0, VISIBLE_COUNT);
  const visibleYears = years.slice(0, VISIBLE_COUNT);

  function go(next: string) {
    if (next === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const params = new URLSearchParams(sp.toString());
    params.delete("from");
    params.delete("to");
    if (next === "all") {
      params.delete("period");
      params.delete("value");
    } else {
      const [p, v] = next.split(":");
      params.set("period", p);
      params.set("value", v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustom() {
    if (!from || !to) return;
    const params = new URLSearchParams(sp.toString());
    params.set("period", "custom");
    params.set("from", from);
    params.set("to", to);
    params.delete("value");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="select" value={showCustom ? "custom" : current} onChange={(e) => go(e.target.value)}>
        <option value="all">All time</option>
        {visibleFys.length > 0 && (
          <optgroup label="Financial year (Jul–Jun)">
            {visibleFys.map((f) => (
              <option key={`fy${f}`} value={`fy:${f}`}>
                {fyLabel(f)}
              </option>
            ))}
          </optgroup>
        )}
        {visibleYears.length > 0 && (
          <optgroup label="Calendar year">
            {visibleYears.map((y) => (
              <option key={`y${y}`} value={`year:${y}`}>
                {y}
              </option>
            ))}
          </optgroup>
        )}
        <option value="custom">Custom range…</option>
      </select>

      {showCustom && (
        <div className="flex items-center gap-1.5">
          <input type="date" className="input !w-auto text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" className="input !w-auto text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn-ghost !py-1 text-sm" onClick={applyCustom} disabled={!from || !to}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
