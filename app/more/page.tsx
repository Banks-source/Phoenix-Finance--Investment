import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { PieChart, FileText, Wallet, Settings2, Tags, BellRing, UserCog, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/categories", label: "Categories", description: "Spend by category, drill into sub-categories", icon: PieChart },
  { href: "/portfolio", label: "Portfolio", description: "Net worth, sleeves, thesis and projections", icon: Wallet },
  { href: "/tax", label: "Tax", description: "Deduction claims and year-over-year comparison", icon: FileText },
  { href: "/settings/categories", label: "Categories & Rules", description: "The sub-category rule engine", icon: Tags },
  { href: "/settings/alerts", label: "Budget Alerts", description: "Email or SMS when a category goes over", icon: BellRing },
  { href: "/settings/account", label: "Account", description: "Change your password", icon: UserCog },
  { href: "/settings", label: "Settings", description: "All configuration", icon: Settings2 },
];

export default function MorePage() {
  return (
    <div className="space-y-5">
      <PageHeader title="More" />
      <div className="card divide-y divide-gray-100">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{l.label}</span>
                <span className="block truncate text-xs text-gray-500">{l.description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
