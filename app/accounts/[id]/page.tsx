import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import BankLogo from "@/components/BankLogo";
import { fetchAccount, fetchAccountTransactions } from "@/lib/balances";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((startOfToday.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export default async function AccountPage({ params }: { params: { id: string } }) {
  const [account, txns] = await Promise.all([fetchAccount(params.id), fetchAccountTransactions(params.id)]);
  if (!account) notFound();

  // Group by day, keeping the feed newest-first like a bank app.
  const groups: { date: string; items: typeof txns }[] = [];
  for (const t of txns) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ChevronLeft size={16} /> Home
      </Link>

      <section className="card p-5">
        <div className="flex items-center gap-3">
          <BankLogo logo={account.logo} institution={account.institution} size={40} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{account.label}</h1>
            <p className="truncate text-xs text-gray-500">
              {account.institution}
              {account.masked ? ` · ${account.masked}` : ""} · {account.owner}
            </p>
          </div>
        </div>
        <div className={`mt-4 text-3xl font-semibold tabular ${account.current < 0 ? "text-rose-600" : ""}`}>
          {money(account.current, { decimals: true })}
        </div>
        {account.available !== null && account.available !== account.current && (
          <div className="text-sm text-gray-500">{money(account.available, { decimals: true })} available</div>
        )}
      </section>

      {groups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No transactions synced for this account yet.</div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.date}>
              <h2 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">{dayLabel(g.date)}</h2>
              <div className="card divide-y divide-gray-100">
                {g.items.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.description}</div>
                      <div className="truncate text-xs text-gray-400">
                        {[t.category, t.sub_category].filter(Boolean).join(" · ") || "Uncategorised"}
                        {t.status === "pending_review" && <span className="ml-1.5 text-amber-600">· to review</span>}
                      </div>
                    </div>
                    <div className={`shrink-0 tabular text-sm font-semibold ${t.amount > 0 ? "text-emerald-600" : ""}`}>
                      {money(t.amount, { decimals: true, sign: t.amount > 0 })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
