import { money } from "@/lib/format";

export interface NetWorthPoint {
  syncedAt: string;
  netWorthAud: number;
}

const W = 320;
const H = 96;
const PAD_X = 6;
const PAD_Y = 10;

/** Compact net-worth line with the latest value and change over the window. Pure SVG, no chart library. */
export default function NetWorthTrend({ points }: { points: NetWorthPoint[] }) {
  // One reading per day (latest wins) so several syncs in a day don't jag the line.
  const byDay = new Map<string, NetWorthPoint>();
  for (const p of points) byDay.set(p.syncedAt.slice(0, 10), p);
  const series = [...byDay.values()].sort((a, b) => a.syncedAt.localeCompare(b.syncedAt));

  const latest = series[series.length - 1];
  const first = series[0];

  if (series.length < 2) {
    return (
      <div>
        <div className="text-2xl font-semibold tabular">{latest ? money(latest.netWorthAud) : "—"}</div>
        <p className="mt-1 text-xs text-gray-500">The trend line appears once a couple of days of syncs have built up.</p>
      </div>
    );
  }

  const values = series.map((p) => p.netWorthAud);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD_X + (i / (series.length - 1)) * (W - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (H - PAD_Y * 2);

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.netWorthAud).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;

  const change = latest.netWorthAud - first.netWorthAud;
  const up = change >= 0;
  const since = new Date(first.syncedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold tabular">{money(latest.netWorthAud)}</div>
        <div className={`text-right text-xs font-medium tabular ${up ? "text-emerald-600" : "text-rose-600"}`}>
          {money(change, { sign: true })}
          <span className="block font-normal text-gray-400">since {since}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-24 w-full" role="img" aria-label="Net worth over time">
        <path d={area} fill="#4f46e5" fillOpacity="0.08" />
        <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(series.length - 1)} cy={y(latest.netWorthAud)} r="3.5" fill="#4f46e5" />
      </svg>
    </div>
  );
}
