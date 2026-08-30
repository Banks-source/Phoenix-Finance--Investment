import { createServiceClient } from "@/lib/supabase/server";
import { listPortfolios, getPortfolioDetail, KuberaPortfolioDetail } from "@/lib/kubera";

export type KuberaSyncResult = {
  syncedAt: string;
  portfolios: { id: string; name: string; netWorth: number; currency: string }[];
};

// Pulls every Kubera portfolio and appends one snapshot row per portfolio.
// Never updates or deletes existing rows — see 0004_portfolio_snapshots.sql.
export async function runKuberaSync(): Promise<KuberaSyncResult> {
  const supabase = createServiceClient();
  const portfolios = await listPortfolios();
  const syncedAt = new Date().toISOString();

  const rows = await Promise.all(
    portfolios.map(async (p) => {
      const detail: KuberaPortfolioDetail = await getPortfolioDetail(p.id);
      return {
        synced_at: syncedAt,
        kubera_portfolio_id: p.id,
        portfolio_name: p.name,
        currency: detail.netWorth.currency,
        total_assets: detail.totalAssets.amount,
        total_debts: detail.totalDebts.amount,
        net_worth: detail.netWorth.amount,
        assets: detail.asset,
        debts: detail.debt,
        raw_response: detail,
      };
    })
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("portfolio_snapshots").insert(rows);
    if (error) throw error;
  }

  return {
    syncedAt,
    portfolios: rows.map((r) => ({
      id: r.kubera_portfolio_id,
      name: r.portfolio_name,
      netWorth: r.net_worth,
      currency: r.currency,
    })),
  };
}
