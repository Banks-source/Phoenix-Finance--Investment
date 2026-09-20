import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Reclassify was a second, different transaction list. Everything now lives in
// /transactions (same filters, same bulk edit) — old links still work.
export default function ReclassifyPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (v) p.set(k, v);
  redirect(`/transactions?${p.toString()}`);
}
