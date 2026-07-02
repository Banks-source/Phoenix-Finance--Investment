import { createServerComponentClient } from "@/lib/supabase/server";

// Merchants tab: aggregated spend per merchant, bulk recategorisation entry point.
export default async function MerchantsPage() {
  const supabase = createServerComponentClient();
  const { data: rows } = await supabase
    .from("transactions")
    .select("merchant, amount, category")
    .eq("status", "approved");

  const byMerchant: Record<string, { total: number; count: number; category: string }> = {};
  for (const r of rows ?? []) {
    const key = r.merchant || "(unknown)";
    byMerchant[key] ??= { total: 0, count: 0, category: r.category };
    byMerchant[key].total += Math.abs(Number(r.amount));
    byMerchant[key].count += 1;
  }

  const sorted = Object.entries(byMerchant).sort((a, b) => b[1].total - a[1].total).slice(0, 100);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Merchants</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="py-2">Merchant</th>
            <th className="py-2">Category</th>
            <th className="py-2 text-right">Transactions</th>
            <th className="py-2 text-right">Total spend</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([merchant, v]) => (
            <tr key={merchant} className="border-t border-neutral-800">
              <td className="py-2">{merchant}</td>
              <td className="py-2">{v.category}</td>
              <td className="py-2 text-right">{v.count}</td>
              <td className="py-2 text-right">${v.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
