import { createServiceClient } from "@/lib/supabase/server";

export interface AccountBalance {
  id: string;
  institution: string;
  label: string;
  masked: string | null;
  owner: string;
  current: number;
  available: number | null;
  observedAt: string | null;
}

export interface BalanceSummary {
  accounts: AccountBalance[];
  cash: number; // everyday/savings positions
  debt: number; // loans and credit cards, as a positive number owed
  net: number;
  observedAt: string | null; // most recent observation across accounts
}

/**
 * Live balances for every linked account. Only Redbark-connected accounts
 * carry a balance — the legacy CSV-era account rows are skipped rather than
 * shown as $0, which would read as a real zero balance.
 */
export async function fetchBalanceSummary(): Promise<BalanceSummary> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, institution, account_label, account_number_masked, owner, balance_current, balance_available, balance_observed_at")
    .not("balance_observed_at", "is", null)
    .order("balance_current", { ascending: false });
  // The balance columns arrive with migration 0016 — until it's applied,
  // show the dashboard without balances rather than failing the whole page.
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return { accounts: [], cash: 0, debt: 0, net: 0, observedAt: null };
    }
    throw new Error(`balances fetch failed: ${error.message}`);
  }

  const accounts: AccountBalance[] = (data ?? []).map((a) => ({
    id: a.id,
    institution: a.institution,
    label: a.account_label,
    masked: a.account_number_masked,
    owner: a.owner,
    current: Number(a.balance_current ?? 0),
    available: a.balance_available === null ? null : Number(a.balance_available),
    observedAt: a.balance_observed_at,
  }));

  let cash = 0;
  let debt = 0;
  for (const a of accounts) {
    if (a.current < 0) debt += Math.abs(a.current);
    else cash += a.current;
  }

  const observedAt = accounts.reduce<string | null>(
    (latest, a) => (a.observedAt && (!latest || a.observedAt > latest) ? a.observedAt : latest),
    null
  );

  return { accounts, cash, debt, net: cash - debt, observedAt };
}
