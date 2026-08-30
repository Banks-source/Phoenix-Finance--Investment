// Vercel sends `Authorization: Bearer $CRON_SECRET` on Cron-triggered requests
// when CRON_SECRET is set as a project env var — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
// Reject anything else so /api/kubera/sync can't be triggered by a bare GET
// from the public internet.
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
