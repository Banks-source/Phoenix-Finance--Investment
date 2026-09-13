import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Phoenix Finance",
  description: "Household budget, investment tracking, and tax organisation",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Phoenix", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the bottom bar clear the home indicator
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
        <ServiceWorkerRegistrar />
        {user && <Nav pending={pending} email={user.email} />}
        {/* pb clears the fixed mobile tab bar; md+ has no bottom bar. */}
        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">{children}</main>
      </body>
    </html>
  );
}
