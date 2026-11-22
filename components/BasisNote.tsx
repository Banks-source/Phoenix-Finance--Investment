import Link from "next/link";
import { money } from "@/lib/format";
import type { Basis } from "@/lib/basis";
import type { UnreviewedSummary } from "@/lib/queries";

/**
 * Sits beside any provisional total: says how much of it is still unreviewed,
 * and lets you flip to confirmed-only (or back) without losing the page's
 * other filters.
 */
export default function BasisNote({
  basis,
  summary,
  path,
  params,
  className = "",
}: {
  basis: Basis;
  summary: UnreviewedSummary;
  path: string;
  params: Record<string, string | undefined>;
  className?: string;
}) {
  const href = (b: Basis) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, basis: b === "confirmed" ? "confirmed" : undefined })) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `${path}?${q}` : path;
  };

  if (summary.count === 0 && basis === "all") return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className}`}>
      {basis === "all" ? (
        <>
          <span>
            Includes <b>{summary.count}</b> unreviewed transaction{summary.count === 1 ? "" : "s"}
            {summary.expense > 0 && <> ({money(summary.expense)} of spending)</>}
            {summary.needsCategory > 0 && <> · {summary.needsCategory} still need a category</>}
          </span>
          <Link href="/review" className="font-medium underline">
            Review
          </Link>
          <Link href={href("confirmed")} className="ml-auto underline">
            Confirmed only
          </Link>
        </>
      ) : (
        <>
          <span>
            Confirmed transactions only — <b>{summary.count}</b> unreviewed not counted
          </span>
          <Link href={href("all")} className="ml-auto font-medium underline">
            Include unreviewed
          </Link>
        </>
      )}
    </div>
  );
}
