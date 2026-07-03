"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fyLabel } from "@/lib/fy";

// Year / Financial-Year / All-time selector that drives page filtering via
// URL search params (?period=fy&value=2026). `fallback` lets a page (e.g. Tax)
// show its default period when the URL has no explicit selection yet.
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

  function go(next: string) {
    const params = new URLSearchParams(sp.toString());
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

  return (
    <select className="select" value={current} onChange={(e) => go(e.target.value)}>
      <option value="all">All time</option>
      {fys.length > 0 && (
        <optgroup label="Financial year (Jul–Jun)">
          {fys.map((f) => (
            <option key={`fy${f}`} value={`fy:${f}`}>
              {fyLabel(f)}
            </option>
          ))}
        </optgroup>
      )}
      {years.length > 0 && (
        <optgroup label="Calendar year">
          {years.map((y) => (
            <option key={`y${y}`} value={`year:${y}`}>
              {y}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
