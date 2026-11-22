import { describe, it, expect } from "vitest";
import { planMovement, pairLegs, MovementRow } from "./moneyMovement";
import { AccountRef } from "./transferAccounts";

const accounts: AccountRef[] = [
  { id: "cba", institution: "CommBank", account_label: "Smart Access", account_number_masked: "xxxx2697" },
  { id: "sav", institution: "CommBank", account_label: "NetBank Saver", account_number_masked: "xxxx5288" },
  { id: "nab", institution: "NATIONAL AUSTRALIA BANK", account_label: "1 Core Spending", account_number_masked: "xxxx8212" },
  { id: "ingm", institution: "ING BANK (Australia) Ltd", account_label: "ING Australia Residential Mortgage", account_number_masked: "xxxx1638" },
  { id: "ingo", institution: "ING BANK (Australia) Ltd", account_label: "ING Australia Orange Everyday", account_number_masked: "xxxx9410" },
  { id: "wbc", institution: "Westpac", account_label: "Flexi Loan", account_number_masked: "xxxx0982" },
];

let n = 0;
const row = (o: Partial<MovementRow> & Pick<MovementRow, "account_id" | "amount" | "detail">): MovementRow => ({
  id: `t${++n}`,
  date: "2026-05-10",
  merchant: null,
  category: "Money Movement",
  sub_category: "Card payment",
  status: "pending_review",
  ...o,
});

describe("pairLegs", () => {
  it("pairs opposite amounts on different accounts a day apart", () => {
    const a = row({ account_id: "cba", amount: -500, detail: "Transfer to xx5288 CommBank app" });
    const b = row({ account_id: "sav", amount: 500, detail: "Transfer from xx2697 CommBank app", date: "2026-05-11" });
    expect(pairLegs([a, b]).get(a.id)).toBe(b.id);
  });

  it("does not pair a coincidental equal amount when neither side reads like a transfer", () => {
    const a = row({ account_id: "nab", amount: -80, detail: "WOOLWORTHS 1234", category: "Groceries" });
    const b = row({ account_id: "cba", amount: 80, detail: "REFUND ACME", category: "Shopping" });
    expect(pairLegs([a, b]).size).toBe(0);
  });

  it("does not pair beyond the window", () => {
    const a = row({ account_id: "cba", amount: -500, detail: "Transfer to savings" });
    const b = row({ account_id: "sav", amount: 500, detail: "Transfer from cba", date: "2026-05-20" });
    expect(pairLegs([a, b]).size).toBe(0);
  });
});

describe("planMovement", () => {
  it("marks paired legs as internal transfers without sending them to review", () => {
    const a = row({ account_id: "cba", amount: -500, detail: "INTERNET PAYMENT Linked Acc Trns", status: "approved" });
    const b = row({ account_id: "nab", amount: 500, detail: "Transfer from CommBank", date: "2026-05-12", status: "approved" });
    const plan = planMovement([a, b], accounts);
    expect(plan).toHaveLength(2);
    expect(plan.every((c) => c.kind === "internal" && c.sub_category === "Internal transfer" && !c.toReview)).toBe(true);
  });

  it("treats a transfer naming one of our account numbers as internal even with no matching leg", () => {
    const [c] = planMovement([row({ account_id: "cba", amount: -90, detail: "Transfer to xx5288 CommBank app" })], accounts);
    expect(c.kind).toBe("internal");
  });

  it("sends a transfer to an unrecognised account to review", () => {
    const [c] = planMovement(
      [row({ account_id: "cba", amount: -60, detail: "Transfer To R LEE PayID Phone from CommBank App MOS TIX", sub_category: "Internal transfer" })],
      accounts
    );
    expect(c).toMatchObject({ kind: "external", sub_category: "Needs review", toReview: true });
    expect(c.reason).toMatch(/don't recognise/);
  });

  it("leaves an external transfer you've already approved alone", () => {
    const plan = planMovement(
      [row({ account_id: "cba", amount: -60, detail: "Transfer To R LEE PayID Phone", sub_category: "External transfer", status: "approved" })],
      accounts
    );
    expect(plan).toEqual([]);
  });

  it("never touches rows already placed in a specific category (rent, salary…)", () => {
    const plan = planMovement(
      [row({ account_id: "cba", amount: -2000, detail: "INTERNET TRANSFER LANG29ML", category: "Rent", sub_category: "Rent Payment", status: "approved" })],
      accounts
    );
    expect(plan).toEqual([]);
  });

  it("books interest and fees charged on the ING loan to Investment, and nothing else on other ING accounts", () => {
    const interest = row({ account_id: "ingm", amount: -2100, detail: "Interest Charged", category: "Fees", sub_category: "Interest charged" });
    const fee = row({ account_id: "ingm", amount: -25, detail: "Late Payment Fee", category: "Fees", sub_category: "Other" });
    const orangeFee = row({ account_id: "ingo", amount: -5, detail: "Account Fee", category: "Fees" });
    const plan = planMovement([interest, fee, orangeFee], accounts);
    expect(plan.map((c) => [c.id, c.category, c.sub_category])).toEqual([
      [interest.id, "Investment", "Loan Interest"],
      [fee.id, "Investment", "Loan Fees"],
    ]);
  });

  it("treats a repayment into the ING loan as a transfer, not an expense", () => {
    const out = row({ account_id: "cba", amount: -3000, detail: "Transfer to ING loan", sub_category: "Internal transfer" });
    const into = row({ account_id: "ingm", amount: 3000, detail: "Payment received", date: "2026-05-11", category: "Money Movement", sub_category: null });
    const plan = planMovement([out, into], accounts);
    expect(plan.find((c) => c.id === into.id)).toMatchObject({ kind: "internal", category: "Money Movement" });
  });

  it("calls a bare Westpac WITHDRAWAL an internal move, but ATM wording stays cash", () => {
    const w = row({ account_id: "wbc", amount: -1500, detail: "WITHDRAWAL", sub_category: null });
    const atm = row({ account_id: "wbc", amount: -100, detail: "ATM WITHDRAWAL", sub_category: "Cash Withdrawal" });
    const plan = planMovement([w, atm], accounts);
    expect(plan.map((c) => [c.id, c.kind])).toEqual([[w.id, "internal"]]);
  });

  it("applies the 'since' cut-off but still uses older rows for pairing", () => {
    const a = row({ account_id: "cba", amount: -500, detail: "Transfer to savings", date: "2025-12-31" });
    const b = row({ account_id: "sav", amount: 500, detail: "Transfer from cba", date: "2026-01-01" });
    const plan = planMovement([a, b], accounts, { since: "2026-01-01" });
    expect(plan.map((c) => c.id)).toEqual([b.id]);
  });
});
