"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AlertRule } from "@/lib/alerts/checkBudgetAlerts";

export default function AlertRulesManager({ rules, categories }: { rules: AlertRule[]; categories: string[] }) {
  const router = useRouter();
  const [category, setCategory] = useState(categories[0] ?? "");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [destination, setDestination] = useState("");
  const [thresholdPct, setThresholdPct] = useState(100);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(false);
    router.refresh();
  }

  async function addRule() {
    if (!destination.trim() || busy) return;
    setBusy(true);
    await fetch("/api/alert-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, channel, destination: destination.trim(), threshold_pct: thresholdPct }),
    });
    setDestination("");
    refresh();
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(true);
    await fetch("/api/alert-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch("/api/alert-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Category
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Channel
          <select className="select" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms")}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          {channel === "email" ? "Email address" : "Phone number"}
          <input
            className="input w-52"
            placeholder={channel === "email" ? "you@example.com" : "+61…"}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Threshold %
          <input
            type="number"
            className="input w-20"
            value={thresholdPct}
            onChange={(e) => setThresholdPct(Number(e.target.value))}
            min={1}
          />
        </label>
        <button className="btn-primary" onClick={addRule} disabled={!destination.trim() || busy}>
          Add alert
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-gray-500">No alert rules yet — add one above.</p>
      ) : (
        <div className="card divide-y divide-gray-100">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.enabled} onChange={(e) => toggle(r.id, e.target.checked)} disabled={busy} />
              </label>
              <span className="w-36 shrink-0 font-medium">{r.category}</span>
              <span className="w-16 shrink-0 uppercase text-gray-400">{r.channel}</span>
              <span className="flex-1 truncate text-gray-600">{r.destination}</span>
              <span className="w-20 shrink-0 text-right tabular text-gray-500">≥ {r.threshold_pct}%</span>
              <button onClick={() => remove(r.id)} disabled={busy} className="text-gray-300 hover:text-rose-600" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
