import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Phoenix Finance",
  description: "Household budget, investment tracking, and tax organisation",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

async function getPendingCount(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review");
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  const pending = user ? await getPendingCount() : 0;

  return (
    <html lang="en">
      <body className="min-h-screen">
        {user && <Nav pending={pending} email={user.email} />}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
