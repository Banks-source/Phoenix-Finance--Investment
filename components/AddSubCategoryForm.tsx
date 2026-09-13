"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function AddSubCategoryForm({ category }: { category: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = value.trim();
    if (!name || busy) return;
    setBusy(true);
    await fetch("/api/sub-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, name }),
    });
    setValue("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        className="input w-40 text-xs"
        placeholder="Add sub-category…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        disabled={busy}
      />
      <button className="btn-ghost !px-2 !py-1" onClick={submit} disabled={!value.trim() || busy} title="Add">
        <Plus size={14} />
      </button>
    </div>
  );
}
