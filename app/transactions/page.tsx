import { createServiceClient } from "@/lib/supabase/server";
import { TYPE_LABELS } from "@/lib/taxonomy";

// Transactions tab: full ledger with filter/search.
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { owner?: string; type?: string };
}) {
  const supabase = createServiceClient();
  let query = supabase
    .from("transactions")
    .select("date, amount, owner, merchant, category, sub_category, type, status")
    .order("date", { ascending: false })
    .limit(100);

  if (searchParams.owner) query = query.eq("owner", searchParams.owner);
  if (searchParams.type) query = query.eq("type", searchParams.type);

  const { data: rows } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Transactions</h1>
      <div className="flex gap-2 text-xs text-neutral-400">
        <a href="/transactions" className="hover:text-white">All</a>
        <a href="/transactions?owner=lloyd" className="hover:text-white">Lloyd</a>
        <a href="/transactions?owner=milani" className="hover:text-white">Milani</a>
        {Object.entries(TYPE_LABELS).map(([k, l]) => (
          <a key={k} href={`/transactions?type=${k}`} className="hover:text-white">{l}</a>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400">
          <tr>
            <th className="py-2">Date</th>
            <th className="py-2">Owner</th>
            <th className="py-2">Merchant</th>
            <th className="py-2">Category</th>
            <th className="py-2">Type</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r, i) => (
            <tr key={i} className="border-t border-neutral-800">
              <td className="py-2">{r.date}</td>
              <td className="py-2 capitalize">{r.owner}</td>
              <td className="py-2">{r.merchant}</td>
              <td className="py-2">{r.category}</td>
              <td className="py-2">{TYPE_LABELS[r.type as keyof typeof TYPE_LABELS]}</td>
              <td className="py-2 text-right">${Number(r.amount).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
