"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectionData } from "@/lib/projectionsServer";
import { THESIS_SLEEVES, SLEEVE_LABELS } from "@/lib/sleeves";
import { money } from "@/lib/format";

async function post(url: string, body: unknown) {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export default function ProjectionsEditor({ data }: { data: ProjectionData }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const [currentAge, setCurrentAge] = useState(data.settings.currentAge != null ? String(data.settings.currentAge) : "");
  const [personalContribution, setPersonalContribution] = useState(String(data.settings.personalMonthlyContribution));
  const [retirementContribution, setRetirementContribution] = useState(String(data.settings.retirementMonthlyContribution));
  const [otherGrowth, setOtherGrowth] = useState(String(data.settings.otherAssetsGrowthPct));
  const [sleeveRates, setSleeveRates] = useState<Record<string, string>>(
    Object.fromEntries(THESIS_SLEEVES.map((s) => [s, String(data.sleeveGrowthRates[s] ?? 0)]))
  );
  const [busy, setBusy] = useState(false);

  async function saveSettings() {
    setBusy(true);
    await post("/api/projection-settings", {
      currentAge: currentAge === "" ? undefined : Number(currentAge),
      personalMonthlyContribution: Number(personalContribution),
      retirementMonthlyContribution: Number(retirementContribution),
      otherAssetsGrowthPct: Number(otherGrowth),
    });
    setBusy(false);
    refresh();
  }

  async function saveSleeveRate(sleeve: string) {
    setBusy(true);
    await post("/api/sleeve-growth-rates", { sleeve, annual_growth_pct: Number(sleeveRates[sleeve]) });
    setBusy(false);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Inputs</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Current age
            <input className="input mt-1 w-full" value={currentAge} onChange={(e) => setCurrentAge(e.target.value)} placeholder="e.g. 45" />
          </label>
          <label className="text-sm">
            Other assets growth %/yr (property, legacy, unclassified)
            <input className="input mt-1 w-full" value={otherGrowth} onChange={(e) => setOtherGrowth(e.target.value)} />
          </label>
          <label className="text-sm">
            Personal monthly contribution ($)
            <input className="input mt-1 w-full" value={personalContribution} onChange={(e) => setPersonalContribution(e.target.value)} />
          </label>
          <label className="text-sm">
            Super/SMSF monthly contribution ($)
            <input className="input mt-1 w-full" value={retirementContribution} onChange={(e) => setRetirementContribution(e.target.value)} />
          </label>
        </div>
        <button className="btn-primary" onClick={saveSettings} disabled={busy}>
          Save & recalculate
        </button>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold">Assumed annual growth rate per sleeve</h2>
        <p className="mb-2 text-xs text-gray-500">
          New contributions are split across sleeves by their current target-band midpoint — set bands on the Thesis page first.
        </p>
        <div className="divide-y divide-gray-100">
          {THESIS_SLEEVES.map((s) => (
            <div key={s} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-48 shrink-0">{SLEEVE_LABELS[s]}</span>
              <input
                className="input !w-20 !py-1 text-xs"
                value={sleeveRates[s]}
                onChange={(e) => setSleeveRates((r) => ({ ...r, [s]: e.target.value }))}
              />
              <span className="text-xs text-gray-400">%/yr</span>
              <button className="btn-ghost !px-2 !py-1" onClick={() => saveSleeveRate(s)} disabled={busy}>
                Save
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Projected value</h2>
        {data.points === null ? (
          <p className="text-sm text-gray-500">Set your current age above to see projections.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Age</th>
                  <th className="px-3 py-2 text-right font-medium">Personal</th>
                  <th className="px-3 py-2 text-right font-medium">Super/SMSF</th>
                  <th className="px-3 py-2 text-right font-medium">Combined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-2 font-medium">Today</td>
                  <td className="px-3 py-2 text-right tabular">{money(data.currentGroupTotals.personal)}</td>
                  <td className="px-3 py-2 text-right tabular">{money(data.currentGroupTotals.retirement)}</td>
                  <td className="px-3 py-2 text-right tabular font-semibold">
                    {money(data.currentGroupTotals.personal + data.currentGroupTotals.retirement)}
                  </td>
                </tr>
                {data.points.map((p) => (
                  <tr key={p.targetAge}>
                    <td className="px-3 py-2 font-medium">
                      {p.targetAge}
                      {p.yearsOut <= 0 && <span className="ml-1 text-xs text-gray-400">(already past)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{money(p.personalAud)}</td>
                    <td className="px-3 py-2 text-right tabular">{money(p.retirementAud)}</td>
                    <td className="px-3 py-2 text-right tabular font-semibold">{money(p.combinedAud)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Reference only, not a forecast — every number above is an assumption you set, not a prediction. Debts aren&apos;t
          modelled forward (no repayment schedule); today&apos;s group totals on the Portfolio page are net of debt, these
          projections are gross asset growth only.
        </p>
      </div>
    </div>
  );
}
