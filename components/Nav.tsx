"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ListChecks,
  PieChart,
  Receipt,
  FileText,
  Wallet,
  LogOut,
  Flame,
  Settings2,
  PiggyBank,
  MoreHorizontal,
} from "lucide-react";

const tabs = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/categories", label: "Categories", icon: PieChart },
  { href: "/review", label: "Review", icon: ListChecks },
  { href: "/budget", label: "Budget", icon: PiggyBank },
  { href: "/tax", label: "Tax", icon: FileText },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

// What fits on a phone's thumb bar — everything else lives behind "More".
const mobileTabs = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/budget", label: "Budget", icon: PiggyBank },
  { href: "/transactions", label: "Activity", icon: Receipt },
  { href: "/review", label: "Review", icon: ListChecks },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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
    <>
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white">
              <Flame size={16} />
            </span>
            <span>Phoenix</span>
          </Link>

          {/* Full tab row on desktop only — phones use the bottom bar. */}
          <nav className="hidden flex-1 items-center gap-0.5 overflow-x-auto md:flex">
            {tabs.map((t) => {
              const active = isActive(pathname, t.href);
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

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {email && <span className="hidden text-xs text-gray-500 lg:inline">{email}</span>}
            <button onClick={logout} className="btn-ghost !px-2 !py-1.5" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom tab bar — phones only, sits above the home indicator. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileTabs.map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                {t.label}
                {t.href === "/review" && pending > 0 && (
                  <span className="absolute right-1/2 top-1 ml-3 translate-x-full rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                    {pending > 99 ? "99+" : pending}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
