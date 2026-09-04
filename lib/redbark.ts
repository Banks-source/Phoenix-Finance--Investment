// Redbark v2 API client (api.redbark.com/v2) — aggregates NAB/CBA/etc. bank
// accounts via Open Banking/CDR. Auth per their OpenAPI spec: every request
// carries `Authorization: Bearer rbk_live_...` and a mandatory
// `Redbark-Version` header. Server-only — never call from a client component.

const BASE_URL = "https://api.redbark.com/v2";

export type RedbarkMoney = { amount: number; currency: string }; // minor units (cents)

export type RedbarkInstitution = { id: string; name: string; logo: string | null };

export type RedbarkConnection = {
  id: string;
  provider: string;
  category: "banking" | "brokerage";
  institution: RedbarkInstitution;
  status: "pending" | "active" | "expiring" | "expired" | "invalidated" | "revoked";
  account_count: number;
};

export type RedbarkAccount = {
  id: string;
  connection: string;
  provider: string;
  category: "banking" | "brokerage";
  name: string;
  type: string;
  institution: RedbarkInstitution;
  account_number: string | null; // masked, last 4 digits only
  currency: string;
  status: string;
};

export type RedbarkTransaction = {
  id: string;
  account: string;
  status: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: RedbarkMoney;
  direction: string;
  provider_category: string | null;
  category: string | null;
  merchant_name: string | null;
};

type RedbarkList<T> = {
  object: "list";
  data: T[];
  next_page_url: string | null;
  previous_page_url: string | null;
};

export class RedbarkApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
    this.name = "RedbarkApiError";
  }
}

function requireCredentials() {
  const apiKey = process.env.REDBARK_API_KEY;
  const apiVersion = process.env.REDBARK_API_VERSION;
  if (!apiKey || !apiVersion) {
    throw new RedbarkApiError("REDBARK_API_KEY / REDBARK_API_VERSION are not set");
  }
  return { apiKey, apiVersion };
}

async function redbarkRequest<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const { apiKey, apiVersion } = requireCredentials();
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Redbark-Version": apiVersion,
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new RedbarkApiError(json?.error?.message ?? `Redbark API request failed (${res.status})`, json?.error?.code, res.status);
  }
  return json as T;
}

export async function listConnections(): Promise<RedbarkConnection[]> {
  const out: RedbarkConnection[] = [];
  let page: string | undefined;
  do {
    const res: RedbarkList<RedbarkConnection> = await redbarkRequest("/connections", { page, limit: "100" });
    out.push(...res.data);
    page = res.next_page_url ? new URL(res.next_page_url).searchParams.get("page") ?? undefined : undefined;
  } while (page);
  return out;
}

export async function listAccounts(connectionId: string): Promise<RedbarkAccount[]> {
  const out: RedbarkAccount[] = [];
  let page: string | undefined;
  do {
    const res: RedbarkList<RedbarkAccount> = await redbarkRequest("/accounts", {
      connection: connectionId,
      page,
      limit: "100",
    });
    out.push(...res.data);
    page = res.next_page_url ? new URL(res.next_page_url).searchParams.get("page") ?? undefined : undefined;
  } while (page);
  return out;
}

export async function listTransactions(
  accountId: string,
  opts: { from?: string; to?: string; includePending?: boolean } = {}
): Promise<RedbarkTransaction[]> {
  const out: RedbarkTransaction[] = [];
  let page: string | undefined;
  do {
    const res: RedbarkList<RedbarkTransaction> = await redbarkRequest("/transactions", {
      account: accountId,
      from: opts.from,
      to: opts.to,
      include_pending: opts.includePending ? "true" : undefined,
      page,
      limit: "100",
    });
    out.push(...res.data);
    page = res.next_page_url ? new URL(res.next_page_url).searchParams.get("page") ?? undefined : undefined;
  } while (page);
  return out;
}
