import { resolveFromTo, AccountRef } from "@/lib/transferAccounts";

export type Flow = { from: string | null; to: string | null };

interface FlowRow {
  id: string;
  account_id?: string | null;
  reference?: string | null;
  amount: number;
  detail?: string | null;
  merchant?: string | null;
}

/**
 * Work out, for each row, which of our accounts the money came from and went
 * to. The two legs of a transfer share a bank reference, so pairing on that
 * names the other account even when the description doesn't.
 */
export function computeFlows(
  rows: (FlowRow & Parameters<typeof resolveFromTo>[0])[],
  accounts: AccountRef[]
): Record<string, Flow> {
  const byRef = new Map<string, { account_id: string }[]>();
  for (const r of rows) {
    if (!r.reference || !r.account_id) continue;
    byRef.set(r.reference, [...(byRef.get(r.reference) ?? []), { account_id: r.account_id }]);
  }
  const flows: Record<string, Flow> = {};
  for (const r of rows) {
    const paired = r.reference ? byRef.get(r.reference)?.find((p) => p.account_id !== r.account_id)?.account_id : null;
    const { from, to } = resolveFromTo(r, accounts, paired);
    flows[r.id] = { from, to };
  }
  return flows;
}
