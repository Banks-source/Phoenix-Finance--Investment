// Currency conversion for the allocation dashboard — Kubera reports each
// holding's value in its own native currency (mostly AUD/USD in practice),
// not converted to one reporting currency. Free, keyless daily-rate API;
// cached in-memory for an hour so a page of holdings doesn't trigger dozens
// of fetches.

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { rates: Record<string, number>; fetchedAt: number } | null = null;

async function getRatesFromUsd(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.rates;
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`FX rate fetch failed (${res.status})`);
  const json = await res.json();
  if (json.result !== "success") throw new Error("FX rate provider returned an error");
  cache = { rates: json.rates, fetchedAt: Date.now() };
  return cache.rates;
}

/** Convert an amount from `from` currency to `to` currency using today's rate. */
export async function convert(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  const rates = await getRatesFromUsd();
  const fromRate = rates[from.toUpperCase()];
  const toRate = rates[to.toUpperCase()];
  if (!fromRate || !toRate) throw new Error(`No FX rate for ${from} or ${to}`);
  // rates are "1 USD = rate[X] X" — convert amount(from) -> USD -> to.
  const amountInUsd = amount / fromRate;
  return amountInUsd * toRate;
}
