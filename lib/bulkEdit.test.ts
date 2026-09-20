import { describe, it, expect } from "vitest";
import { buildBulkUpdate } from "./bulkEdit";

describe("buildBulkUpdate", () => {
  it("recomputes type from the category and clears the sub-category unless one is given", () => {
    expect(buildBulkUpdate({ category: "Rent", keepStatus: true })).toEqual({
      update: { category: "Rent", sub_category: null, type: "bills_fixed" },
      learnedType: "bills_fixed",
    });
    const r = buildBulkUpdate({ category: "Rent", sub_category: "Rent Payment", keepStatus: true });
    expect("update" in r && r.update.sub_category).toBe("Rent Payment");
  });

  it("a sub-category on its own leaves category and type untouched", () => {
    expect(buildBulkUpdate({ sub_category: "Coffee", keepStatus: true })).toEqual({ update: { sub_category: "Coffee" } });
  });

  it("can change several things at once, including owner and status", () => {
    const r = buildBulkUpdate({ category: "Groceries", owner: "joint", status: "approved" });
    expect(r).toMatchObject({ update: { category: "Groceries", owner: "joint", status: "approved", review_reason: null } });
  });

  it("approves by default and resolves the review note", () => {
    expect(buildBulkUpdate({ sub_category: "x" })).toMatchObject({ update: { status: "approved", review_reason: null } });
  });

  it("can send rows back to review without clearing the note", () => {
    const r = buildBulkUpdate({ status: "pending_review" });
    expect(r).toEqual({ update: { status: "pending_review" } });
  });

  it("rejects an unknown owner and an empty edit", () => {
    expect(buildBulkUpdate({ owner: "someone", keepStatus: true })).toHaveProperty("error");
    expect(buildBulkUpdate({ keepStatus: true })).toEqual({ error: "nothing to update" });
  });
});
