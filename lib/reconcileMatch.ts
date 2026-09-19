export interface RbTxn {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed dollars
  /** Our accounts.id for the Redbark account, used to prefer same-account matches. */
  accountId: string | null;
}

export interface DbTxn {
  id: string;
  date: string;
  amount: number;
  account_id: string | null;
  bank_txn_id: string | null;
}

export interface MatchResult<D extends DbTxn = DbTxn> {
  /** Redbark txn -> database row, and how many days the dates differ by. */
  matches: { rb: RbTxn; db: D; shiftDays: number; byId: boolean }[];
  missingInDb: RbTxn[];
  unmatchedDb: D[];
}

const cents = (n: number) => Math.round(n * 100);
const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/**
 * Pairs bank transactions with stored rows one-to-one. Rows imported from
 * statements often carry a different date to the bank feed (transaction vs
 * posting date), so after matching on bank id we accept an identical amount
 * within `maxShiftDays`, preferring the same account and the closest date.
 */
export function matchTransactions<D extends DbTxn>(rb: RbTxn[], db: D[], maxShiftDays = 7): MatchResult<D> {
  const used = new Set<string>();
  const matches: MatchResult<D>["matches"] = [];
  const dbByBankId = new Map(db.filter((r) => r.bank_txn_id).map((r) => [r.bank_txn_id!, r]));

  const rest: RbTxn[] = [];
  for (const t of rb) {
    const hit = dbByBankId.get(t.id);
    if (hit && !used.has(hit.id)) {
      used.add(hit.id);
      matches.push({ rb: t, db: hit, shiftDays: Math.abs(day(hit.date) - day(t.date)), byId: true });
    } else rest.push(t);
  }

  // Unlinked rows only, indexed by amount so matching stays fast on thousands of rows.
  const pool = new Map<number, D[]>();
  for (const r of db) {
    if (r.bank_txn_id || used.has(r.id)) continue;
    const k = cents(r.amount);
    const list = pool.get(k);
    if (list) list.push(r);
    else pool.set(k, [r]);
  }

  const missingInDb: RbTxn[] = [];
  for (const t of [...rest].sort((a, b) => a.date.localeCompare(b.date))) {
    let best: { r: D; score: number; shift: number } | null = null;
    for (const r of pool.get(cents(t.amount)) ?? []) {
      if (used.has(r.id)) continue;
      const shift = Math.abs(day(r.date) - day(t.date));
      if (shift > maxShiftDays) continue;
      const score = (t.accountId && r.account_id === t.accountId ? 0 : 100) + shift;
      if (!best || score < best.score) best = { r, score, shift };
    }
    if (best) {
      used.add(best.r.id);
      matches.push({ rb: t, db: best.r, shiftDays: best.shift, byId: false });
    } else missingInDb.push(t);
  }

  return { matches, missingInDb, unmatchedDb: db.filter((r) => !used.has(r.id)) };
}

/** Rows that look like the same transaction entered twice; returns the extras. */
export function findDuplicateExtras<T extends { id: string; owner: string; date: string; amount: number; detail: string | null }>(
  rows: T[]
): T[] {
  const seen = new Map<string, T>();
  const extras: T[] = [];
  for (const r of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = `${r.owner}|${r.date}|${cents(r.amount)}|${r.detail ?? ""}`;
    if (seen.has(key)) extras.push(r);
    else seen.set(key, r);
  }
  return extras;
}
