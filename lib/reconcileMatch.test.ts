import { describe, it, expect } from "vitest";
import { matchTransactions, RbTxn, DbTxn } from "./reconcileMatch";

const rb = (id: string, date: string, amount: number, accountId: string | null = "a1"): RbTxn => ({ id, date, amount, accountId });
const db = (id: string, date: string, amount: number, extra: Partial<DbTxn> = {}): DbTxn => ({
  id,
  date,
  amount,
  account_id: "a1",
  bank_txn_id: null,
  ...extra,
});

describe("matchTransactions", () => {
  it("matches by bank id first, whatever the date", () => {
    const r = matchTransactions([rb("t1", "2026-03-05", -10)], [db("d1", "2026-03-01", -99, { bank_txn_id: "t1" })]);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].byId).toBe(true);
    expect(r.missingInDb).toHaveLength(0);
  });

  it("matches the same amount a few days apart (transaction vs posting date)", () => {
    const r = matchTransactions([rb("t1", "2026-03-05", -22.75)], [db("d1", "2026-03-02", -22.75)]);
    expect(r.matches[0]).toMatchObject({ shiftDays: 3, byId: false });
  });

  it("does not match beyond the allowed shift or on a different amount", () => {
    const r = matchTransactions([rb("t1", "2026-03-20", -22.75), rb("t2", "2026-03-05", -22.76)], [db("d1", "2026-03-02", -22.75)]);
    expect(r.missingInDb.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
    expect(r.unmatchedDb.map((d) => d.id)).toEqual(["d1"]);
  });

  it("pairs one-to-one so two identical bank rows need two stored rows", () => {
    const r = matchTransactions(
      [rb("t1", "2026-03-05", -5), rb("t2", "2026-03-05", -5)],
      [db("d1", "2026-03-05", -5)]
    );
    expect(r.matches).toHaveLength(1);
    expect(r.missingInDb).toHaveLength(1);
  });

  it("prefers the same account, then the closest date", () => {
    const r = matchTransactions(
      [rb("t1", "2026-03-05", -5, "a1")],
      [db("other", "2026-03-05", -5, { account_id: "a2" }), db("same", "2026-03-03", -5, { account_id: "a1" })]
    );
    expect(r.matches[0].db.id).toBe("same");
  });

  it("reports stored rows with no bank counterpart", () => {
    const r = matchTransactions([], [db("d1", "2026-03-05", -5)]);
    expect(r.unmatchedDb).toHaveLength(1);
  });
});
