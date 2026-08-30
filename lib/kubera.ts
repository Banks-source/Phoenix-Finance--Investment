import { createHmac } from "crypto";

// Kubera Data API v3 client. Auth per https://help.kubera.com/article/171-kubera-data-api-v3:
// every request carries x-api-token, x-timestamp (unix seconds) and an
// x-signature HMAC-SHA256 of (apiKey + timestamp + method + path + compact-JSON-body),
// hex-encoded, signed with the API secret. Server-only — never call from a client component.

const BASE_URL = "https://api.kubera.com/api/v3/data";

export type KuberaPortfolioSummary = {
  id: string;
  name: string;
  currency: string;
};

export type KuberaMoney = { amount: number; currency: string };

export type KuberaPortfolioDetail = {
  asset: unknown[];
  debt: unknown[];
  totalAssets: KuberaMoney;
  totalDebts: KuberaMoney;
  netWorth: KuberaMoney;
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
  const signature = signRequest(apiSecret, apiKey, timestamp, method, path, bodyStr);

  const res = await fetch(`${BASE_URL}${path}`, {
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
