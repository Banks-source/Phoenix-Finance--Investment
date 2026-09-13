import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { Tags, BellRing } from "lucide-react";

export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/settings/categories",
    title: "Categories & Rules",
    description: "The sub-category rule engine — add new sub-categories per category, remove unused ones.",
    icon: Tags,
  },
  {
    href: "/settings/alerts",
    title: "Budget Alerts",
    description: "Email or SMS alerts when a category goes over budget.",
    icon: BellRing,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure how Phoenix Finance categorises transactions and alerts you." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="card flex items-start gap-3 p-5 hover:bg-gray-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon size={18} />
              </span>
              <div>
                <div className="font-medium">{s.title}</div>
                <p className="mt-0.5 text-sm text-gray-500">{s.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
