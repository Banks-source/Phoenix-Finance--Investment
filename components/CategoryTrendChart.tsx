"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { money } from "@/lib/format";
import { X } from "lucide-react";

const DEFAULT_VISIBLE = 10;

// Fixed categorical palette, cycled if more categories are selected than colors.
const PALETTE = [
  "#e11d48", "#3b82f6", "#059669", "#f59e0b", "#8b5cf6",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
}

export default function CategoryTrendChart({
  categories,
  series,
}: {
  categories: string[];
  series: ({ month: string } & Record<string, number | string>)[];
}) {
  const [selected, setSelected] = useState<string[]>(categories.slice(0, DEFAULT_VISIBLE));
  const [adding, setAdding] = useState(false);

  const available = useMemo(() => categories.filter((c) => !selected.includes(c)), [categories, selected]);
  const colorFor = (cat: string) => PALETTE[selected.indexOf(cat) % PALETTE.length];

  function remove(cat: string) {
    setSelected((s) => s.filter((c) => c !== cat));
  }
  function add(cat: string) {
    if (!cat) return;
    setSelected((s) => [...s, cat]);
    setAdding(false);
  }

  const chartData = useMemo(
    () => series.map((point) => ({ ...point, monthLabel: monthLabel(point.month) })),
    [series]
  );

  if (categories.length === 0) {
    return <p className="text-sm text-gray-400">No categorised spend in this period yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{ borderColor: colorFor(cat), color: colorFor(cat) }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(cat) }} />
            {cat}
            <button onClick={() => remove(cat)} className="ml-0.5 text-gray-400 hover:text-gray-700" aria-label={`Remove ${cat}`}>
              <X size={12} />
            </button>
          </span>
        ))}

        {adding ? (
          <select
            autoFocus
            className="select text-xs"
            value=""
            onChange={(e) => add(e.target.value)}
            onBlur={() => setAdding(false)}
          >
            <option value="">Choose category…</option>
            {available.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          available.length > 0 && (
            <button className="btn-ghost !py-1 text-xs" onClick={() => setAdding(true)}>
              + Add category
            </button>
          )
        )}
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => money(v)} width={70} />
            <Tooltip formatter={(v: number) => money(v, { decimals: true })} labelStyle={{ fontWeight: 600 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {selected.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                name={cat}
                stroke={colorFor(cat)}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
