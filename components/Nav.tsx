"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ListChecks,
  PieChart,
  Receipt,
  Upload,
  FileText,
  LogOut,
  Flame,
} from "lucide-react";

const tabs = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/categories", label: "Categories", icon: PieChart },
  { href: "/review", label: "Review", icon: ListChecks },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/tax", label: "Tax", icon: FileText },
];

export default function Nav({ pending, email }: { pending: number; email?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white">
            <Flame size={16} />
          </span>
          <span className="hidden sm:inline">Phoenix</span>
        </Link>

        <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={15} />
                {t.label}
                {t.href === "/review" && pending > 0 && (
                  <span className="ml-0.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {email && <span className="hidden text-xs text-gray-500 md:inline">{email}</span>}
          <button onClick={logout} className="btn-ghost !px-2 !py-1.5" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
