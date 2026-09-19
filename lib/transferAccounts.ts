export interface AccountRef {
  id: string;
  institution: string | null;
  account_label: string | null;
  account_number_masked: string | null;
}

export function accountName(a: Pick<AccountRef, "institution" | "account_label"> | undefined | null): string | null {
  if (!a) return null;
  const label = a.account_label ?? "";
  const inst = a.institution ?? "";
  if (!label) return inst || null;
  return inst && !label.toUpperCase().includes(inst.toUpperCase()) ? `${inst} ${label}` : label;
}

function digitsOf(a: AccountRef): string[] {
  const out = new Set<string>();
  for (const v of [a.account_label, a.account_number_masked]) {
    for (const m of (v ?? "").matchAll(/\d{4,}/g)) {
      out.add(m[0]);
      out.add(m[0].slice(-4));
    }
  }
  return [...out];
}

/** The other one of our accounts named in a bank description, e.g. "Transfer to xx2697". */
export function findCounterpartAccount(detail: string | null, ownId: string, accounts: AccountRef[]): AccountRef | null {
  if (!detail) return null;
  for (const a of accounts) {
    if (a.id === ownId) continue;
    for (const d of digitsOf(a)) {
      if (new RegExp(`(?<!\\d)${d}(?!\\d)`).test(detail)) return a;
    }
  }
  return null;
}

export interface FromTo {
  from: string | null;
  to: string | null;
  /** True when the other side is one of our own accounts. */
  internal: boolean;
}

/**
 * Which account the money left and which it landed in. The other side is known
 * when it's one of our accounts (named in the description, or paired by the
 * shared bank reference); otherwise it's left null rather than guessed.
 */
export function resolveFromTo(
  t: { account_id?: string | null; detail: string | null; amount: number },
  accounts: AccountRef[],
  pairedAccountId?: string | null
): FromTo {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const own = t.account_id ? byId.get(t.account_id) : undefined;
  const other =
    (pairedAccountId ? byId.get(pairedAccountId) : undefined) ??
    (t.account_id ? findCounterpartAccount(t.detail, t.account_id, accounts) : null);
  const ownName = accountName(own);
  const otherName = accountName(other);
  return t.amount < 0
    ? { from: ownName, to: otherName, internal: !!other }
    : { from: otherName, to: ownName, internal: !!other };
}
