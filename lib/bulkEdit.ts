import { resolveType } from "@/lib/taxonomy";

export const OWNERS = ["lloyd", "milani", "joint"] as const;

export interface BulkPatch {
  category?: string;
  /** With a category: the new sub-category (null clears it). Alone: changes only the sub-category. */
  sub_category?: string | null;
  owner?: string;
  status?: "pending_review" | "approved";
  /** Leave approval status as it is (the default for edits from list views). */
  keepStatus?: boolean;
}

export type BulkUpdate = { update: Record<string, unknown>; learnedType?: string } | { error: string };

/**
 * Turns an edit request into the column changes to apply. A category change
 * recomputes `type` from the taxonomy; a sub-category on its own leaves the
 * category and type alone. Unless told otherwise an edit approves the row.
 */
export function buildBulkUpdate(p: BulkPatch): BulkUpdate {
  const update: Record<string, unknown> = {};
  let learnedType: string | undefined;

  if (p.category) {
    learnedType = resolveType(p.category, p.sub_category ?? undefined);
    update.category = p.category;
    update.sub_category = p.sub_category ?? null;
    update.type = learnedType;
  } else if (p.sub_category !== undefined) {
    update.sub_category = p.sub_category;
  }

  if (p.owner !== undefined) {
    if (!(OWNERS as readonly string[]).includes(p.owner)) return { error: `owner must be one of ${OWNERS.join(", ")}` };
    update.owner = p.owner;
  }

  const status = p.status ?? (p.keepStatus ? undefined : "approved");
  if (status) {
    update.status = status;
    if (status === "approved") update.review_reason = null; // resolved
  }

  if (Object.keys(update).length === 0) return { error: "nothing to update" };
  return { update, learnedType };
}
