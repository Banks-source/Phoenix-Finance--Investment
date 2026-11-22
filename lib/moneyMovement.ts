import { AccountRef, findCounterpartAccount } from "@/lib/transferAccounts";
import { resolveType } from "@/lib/taxonomy";

// Money-movement engine. Decides, for bank-feed rows, whether money moved
// between our own accounts (Money Movement › Internal transfer — net-worth
// neutral, never spending) or left to an account we don't recognise (needs a
// category from you — and then it's remembered). Also pins interest and fees
// charged on the ING loan account to Investment.
//
// Pure: takes rows + accounts, returns the changes to make. Nothing here
// touches the database.

export interface MovementRow {
  id: string;
  account_id: string | null;
  date: string;
  amount: number;
  detail: string | null;
  merchant: string | null;
  category: string | null;
  sub_category: string | null;
  status: string;
}

export type MovementKind = "internal" | "external" | "loan_interest" | "loan_fee";

export interface MovementChange {
  id: string;
  kind: MovementKind;
  category: string;
  sub_category: string;
  type: string;
  /** Set when the row has to go (back) to Review; null when it can stay as it is. */
  toReview: boolean;
  reason: string | null;
  pairedWith?: string;
}

/** A transfer's two legs normally post within a day or two; allow for weekends and public holidays. */
export const PAIR_WINDOW_DAYS = 4;

const TRANSFERISH =
  /TRANSFER|LINKED ACC|INTERNET PAYMENT|FUNDS TRNS|\bTFR\b|WITHDRAWAL|REPAYMENT|REDRAW|OSKO|PAYID|\bBPAY\b|PAYMENT TO|PAYMENT FROM|DESCRIPTION NOT CURRENTLY AVAILABLE/;

// Wording that, on its own, means "one of our own accounts": NAB "Linked Acc
// Trns" (transfers between accounts in the same profile), the Westpac buffer
// loan, the ING loan (Ashby), and our own names.
const OWN_TEXT = /LINKED ACC TRNS|WESTPAC PAYMENT|TFR (FROM|TO) WESTPA|ASHBY( INV)? LOAN|\bTHOMAS L\b|(LLOYD.*THOMA|THOMA.*LLOYD)|(MILANI.*SIM|SIM.*MILANI)/;

// Money Movement buckets that are already specific and not "which account?"
const KEEP_SUBS = new Set(["Cash Withdrawal", "ZipMoney", "Centrelink"]);

const OPEN = new Set(["Money Movement", "Uncategorised"]);

export const isLoanAccount = (a: Pick<AccountRef, "institution" | "account_label"> | undefined | null) =>
  !!a && /\bING\b/i.test(a.institution ?? "") && /mortgage|loan/i.test(a.account_label ?? "");

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

function upper(r: MovementRow) {
  return `${r.detail ?? ""} ${r.merchant ?? ""}`.toUpperCase();
}

/** True when the row is still "open" — not already placed in a specific category by you or a rule. */
function isOpen(r: MovementRow) {
  return !r.category || OPEN.has(r.category);
}

export function looksLikeTransfer(r: MovementRow): boolean {
  return TRANSFERISH.test(upper(r)) || OWN_TEXT.test(upper(r));
}

/**
 * Pair up the two legs of each transfer: opposite amounts, different accounts,
 * a few days apart, and at least one leg that reads like a transfer. Greedy by
 * date proximity so each leg is used once.
 */
export function pairLegs(rows: MovementRow[]): Map<string, string> {
  const candidates = rows.filter((r) => r.account_id && (looksLikeTransfer(r) || isOpen(r)));
  const out = candidates.filter((r) => r.amount < 0);
  const inn = candidates.filter((r) => r.amount > 0);

  const byAmount = new Map<number, MovementRow[]>();
  for (const r of inn) {
    const k = Math.round(r.amount * 100);
    (byAmount.get(k) ?? byAmount.set(k, []).get(k)!).push(r);
  }

  const pairs: { a: MovementRow; b: MovementRow; gap: number }[] = [];
  for (const a of out) {
    for (const b of byAmount.get(Math.round(-a.amount * 100)) ?? []) {
      if (a.account_id === b.account_id) continue;
      const gap = daysBetween(a.date, b.date);
      if (gap > PAIR_WINDOW_DAYS) continue;
      // a coincidental equal amount is not a transfer unless one side says it is
      if (!looksLikeTransfer(a) && !looksLikeTransfer(b)) continue;
      // never pull a leg you or a rule have already placed (rent, salary…)
      if (!isOpen(a) && !looksLikeTransfer(a)) continue;
      if (!isOpen(b) && !looksLikeTransfer(b)) continue;
      pairs.push({ a, b, gap });
    }
  }
  pairs.sort((x, y) => x.gap - y.gap || x.a.date.localeCompare(y.a.date) || x.a.id.localeCompare(y.a.id));

  const used = new Set<string>();
  const paired = new Map<string, string>();
  for (const { a, b } of pairs) {
    if (used.has(a.id) || used.has(b.id)) continue;
    used.add(a.id);
    used.add(b.id);
    paired.set(a.id, b.id);
    paired.set(b.id, a.id);
  }
  return paired;
}

const INTERNAL = { category: "Money Movement", sub_category: "Internal transfer" } as const;

export function planMovement(rows: MovementRow[], accounts: AccountRef[], opts: { since?: string } = {}): MovementChange[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const paired = pairLegs(rows);
  const changes: MovementChange[] = [];

  for (const r of rows) {
    if (opts.since && r.date < opts.since) continue;
    const account = r.account_id ? byId.get(r.account_id) : undefined;
    const text = upper(r);

    // 1. cost of the ING loan
    if (isLoanAccount(account) && r.amount < 0 && /INTEREST|FEE/.test(text) && !/REPAYMENT/.test(text)) {
      const sub = /FEE/.test(text) ? "Loan Fees" : "Loan Interest";
      if (r.category === "Investment" && r.sub_category === sub) continue;
      changes.push({
        id: r.id,
        kind: sub === "Loan Fees" ? "loan_fee" : "loan_interest",
        category: "Investment",
        sub_category: sub,
        type: resolveType("Investment", sub),
        toReview: r.status === "approved" && r.category !== "Investment",
        reason: r.status === "approved" && r.category !== "Investment" ? `ING loan ${sub.toLowerCase()} (was ${r.category ?? "uncategorised"})` : null,
      });
      continue;
    }

    // 2. only rows that haven't been placed already are the engine's to move
    const onLoan = isLoanAccount(account);
    if (!isOpen(r) || (!looksLikeTransfer(r) && !(onLoan && r.category === "Money Movement") && !paired.has(r.id))) continue;
    if (r.sub_category && KEEP_SUBS.has(r.sub_category) && !paired.has(r.id)) continue;

    const partner = paired.get(r.id);
    const ownAccount = r.account_id ? findCounterpartAccount(r.detail, r.account_id, accounts) : null;
    // a bare "WITHDRAWAL" on a Westpac account is the buffer loan paying out to our own account, not cash
    const westpacBuffer = /westpac/i.test(account?.institution ?? "") && /\bWITHDRAWAL\b/.test(text) && !/ATM|CASH/.test(text);
    const internal = !!partner || !!ownAccount || OWN_TEXT.test(text) || westpacBuffer;

    if (internal) {
      if (r.category === INTERNAL.category && r.sub_category === INTERNAL.sub_category) continue;
      const wasApprovedElsewhere = r.status === "approved" && r.category !== "Money Movement";
      changes.push({
        id: r.id,
        kind: "internal",
        ...INTERNAL,
        type: resolveType(INTERNAL.category, INTERNAL.sub_category),
        toReview: wasApprovedElsewhere,
        reason: wasApprovedElsewhere ? `Moved between your own accounts (was ${r.category ?? "uncategorised"})` : null,
        pairedWith: partner,
      });
      continue;
    }

    // 3. a transfer to/from somewhere we don't recognise — needs a category from you
    if (r.status === "approved" && r.sub_category && r.sub_category !== "Needs review") continue; // you've already accepted it
    if (r.sub_category === "Needs review" && r.status !== "approved") continue; // already waiting
    changes.push({
      id: r.id,
      kind: "external",
      category: "Money Movement",
      sub_category: "Needs review",
      type: resolveType("Money Movement", "Needs review"),
      toReview: true,
      reason:
        r.amount < 0
          ? "Sent to an account I don't recognise — pick a category (it's remembered for this payee)"
          : "Received from an account I don't recognise — pick a category (it's remembered for this payee)",
    });
  }
  return changes;
}
