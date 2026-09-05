import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on all routes except static assets, the PWA manifest/icons, and
  // /api/kubera|redbark/* — those routes are hit by Vercel Cron (no session
  // cookie exists for it) and enforce their own CRON_SECRET bearer-token
  // check instead (see lib/cronAuth.ts).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/kubera|api/redbark|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
