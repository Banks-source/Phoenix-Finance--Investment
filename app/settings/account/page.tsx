import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user?.email) redirect("/login");

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeader title="Account" subtitle="Your sign-in details." />

      <section className="card divide-y divide-gray-100">
        <div className="px-4 py-3">
          <div className="label-caps">Signed in as</div>
          <div className="mt-0.5 text-sm font-medium">{user.email}</div>
        </div>
        <div className="px-4 py-3">
          <div className="label-caps">Last sign-in</div>
          <div className="mt-0.5 text-sm">{lastSignIn}</div>
        </div>
      </section>

      <ChangePasswordForm email={user.email} />
    </div>
  );
}
