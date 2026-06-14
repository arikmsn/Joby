// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
// External triggers (e.g. cron-job.org) use "x-cron-secret: <CRON_SECRET>".
// Both are accepted so the same CRON_SECRET works for either.
export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const legacyHeader = req.headers.get("x-cron-secret");
  if (legacyHeader === cronSecret) return true;

  return false;
}
