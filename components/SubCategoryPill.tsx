"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function SubCategoryPill({ category, name, count }: { category: string; name: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/sub-categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, name }),
    });
    router.refresh();
  }

  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
        count === 0 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-700"
      }`}
    >
      {name}
      <span className="text-[10px] text-gray-400">{count}</span>
      {count === 0 && (
        <button
          onClick={remove}
          disabled={busy}
          className="ml-0.5 rounded-full text-amber-500 hover:text-amber-700 disabled:opacity-50"
          title={`Delete unused sub-category "${name}"`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
