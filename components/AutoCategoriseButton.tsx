"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function AutoCategoriseButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/categorise/run", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(`Failed: ${d.error ?? res.status}`);
    const parts = [
      d.movement?.changes ? `${d.movement.changes} transfers matched` : null,
      d.placedByMemory ? `${d.placedByMemory} placed from memory` : null,
      d.claude?.rowsCategorised ? `${d.claude.rowsCategorised} suggested by Claude` : null,
    ].filter(Boolean);
    setMsg(parts.length ? parts.join(" · ") : "Nothing new to categorise");
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
      <button className="btn-ghost" onClick={run} disabled={busy} title="Runs the daily pass now: match transfers, apply memory, ask Claude about the rest">
        <Sparkles size={14} /> {busy ? "Working…" : "Auto-categorise"}
      </button>
    </div>
  );
}
