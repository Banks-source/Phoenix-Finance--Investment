import { createHmac } from "crypto";

// Kubera Data API v3 client. Auth per https://help.kubera.com/article/171-kubera-data-api-v3
// (confirmed against the reference implementation at
// github.com/the-mace/kubera-python-api/blob/main/kubera/auth.py): every
// request carries x-api-token, x-timestamp (unix seconds) and an
// x-signature HMAC-SHA256 of (apiKey + timestamp + method + full-request-path
// + compact-JSON-body), hex-encoded, signed with the API secret. Critically,
// "full request path" means including the /api/v3/data prefix, not just the
// part after it — server-only, never call from a client component.

const HOST = "https://api.kubera.com";
const API_PREFIX = "/api/v3/data";

export type KuberaPortfolioSummary = {
  id: string;
  name: string;
  currency: string;
};

// Portfolio-detail totals are plain numbers, not {amount, currency} objects —
// confirmed against the live API (the docs' abbreviated example was wrong on
// this point). The detail response carries no currency of its own; the
// portfolio's display currency comes from KuberaPortfolioSummary.currency.
// Individual asset/debt line items do carry per-item {amount, currency}.
export type KuberaPortfolioDetail = {
  asset: unknown[];
  debt: unknown[];
  assetTotal: number;
  debtTotal: number;
  netWorth: number;
};

type KuberaEnvelope<T> = { data: T; errorCode: number; errorMessage?: string };

export class KuberaApiError extends Error {
  constructor(message: string, readonly errorCode?: number, readonly status?: number) {
    super(message);
    this.name = "KuberaApiError";
  }
}

function requireCredentials() {
  const apiKey = process.env.KUBERA_API_KEY;
  const apiSecret = process.env.KUBERA_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new KuberaApiError("KUBERA_API_KEY / KUBERA_API_SECRET are not set");
  }
  return { apiKey, apiSecret };
}

export function signRequest(
  apiSecret: string,
  apiKey: string,
  timestamp: string,
  method: string,
  path: string,
  body: string
): string {
  const message = `${apiKey}${timestamp}${method}${path}${body}`;
  return createHmac("sha256", apiSecret).update(message).digest("hex");
}

async function kuberaRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const { apiKey, apiSecret } = requireCredentials();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body === undefined ? "" : JSON.stringify(body);
  const fullPath = `${API_PREFIX}${path}`;
  const signature = signRequest(apiSecret, apiKey, timestamp, method, fullPath, bodyStr);

  const res = await fetch(`${HOST}${fullPath}`, {
    method,
    headers: {
      "x-api-token": apiKey,
      "x-timestamp": timestamp,
      "x-signature": signature,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: bodyStr || undefined,
  });

  const json = (await res.json()) as KuberaEnvelope<T>;
  if (!res.ok || json.errorCode !== 0) {
    throw new KuberaApiError(
      json.errorMessage ?? `Kubera API request failed (${res.status})`,
      json.errorCode,
      res.status
    );
  }
  return json.data;
}

export function listPortfolios(): Promise<KuberaPortfolioSummary[]> {
  return kuberaRequest<KuberaPortfolioSummary[]>("GET", "/portfolio");
}

export function getPortfolioDetail(portfolioId: string): Promise<KuberaPortfolioDetail> {
  return kuberaRequest<KuberaPortfolioDetail>("GET", `/portfolio/${portfolioId}`);
}
