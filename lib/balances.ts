import { createServiceClient } from "@/lib/supabase/server";

export interface AccountBalance {
  id: string;
  institution: string;
  logo: string | null;
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

const BASE_COLUMNS = "id, institution, account_label, account_number_masked, owner, balance_current, balance_available, balance_observed_at";

// Columns arrive with migrations 0016 (balances) and 0017 (logo). Until each
// is applied, degrade instead of failing the whole page.
const MISSING_COLUMN = (code?: string) => code === "42703" || code === "PGRST204";

type Row = Record<string, any>;

function toAccount(a: Row): AccountBalance {
  return {
    id: a.id,
    institution: a.institution,
    logo: a.institution_logo ?? null,
    label: a.account_label,
    masked: a.account_number_masked,
    owner: a.owner,
    current: Number(a.balance_current ?? 0),
    available: a.balance_available === null || a.balance_available === undefined ? null : Number(a.balance_available),
    observedAt: a.balance_observed_at ?? null,
  };
}

/**
 * Live balances for every linked account. Only Redbark-connected accounts
 * carry a balance — the legacy CSV-era account rows are skipped rather than
 * shown as $0, which would read as a real zero balance.
 */
export async function fetchBalanceSummary(): Promise<BalanceSummary> {
  const supabase = createServiceClient();
  const query = (cols: string) =>
    supabase.from("accounts").select(cols).not("balance_observed_at", "is", null).order("balance_current", { ascending: false });

  let { data, error } = await query(`${BASE_COLUMNS}, institution_logo`);
  if (error && MISSING_COLUMN(error.code)) ({ data, error } = await query(BASE_COLUMNS));
  if (error) {
    if (MISSING_COLUMN(error.code)) return { accounts: [], cash: 0, debt: 0, net: 0, observedAt: null };
    throw new Error(`balances fetch failed: ${error.message}`);
  }

  const accounts = ((data ?? []) as unknown as Row[]).map(toAccount);

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

export interface AccountTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  sub_category: string | null;
  status: string;
}

export async function fetchAccount(id: string): Promise<AccountBalance | null> {
  const supabase = createServiceClient();
  let { data, error } = await supabase.from("accounts").select(`${BASE_COLUMNS}, institution_logo`).eq("id", id).maybeSingle();
  if (error && MISSING_COLUMN(error.code)) ({ data, error } = await supabase.from("accounts").select(BASE_COLUMNS).eq("id", id).maybeSingle());
  if (error) throw new Error(`account fetch failed: ${error.message}`);
  return data ? toAccount(data as unknown as Row) : null;
}

/** Newest-first transactions for one account, any review status — like the bank's own feed. */
export async function fetchAccountTransactions(accountId: string, limit = 150): Promise<AccountTransaction[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, amount, merchant, detail, category, sub_category, status")
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`account transactions fetch failed: ${error.message}`);
  return (data ?? []).map((t) => ({
    id: t.id,
    date: t.date,
    amount: Number(t.amount),
    description: t.merchant || t.detail || "Transaction",
    category: t.category,
    sub_category: t.sub_category,
    status: t.status,
  }));
}
