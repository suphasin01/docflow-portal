/**
 * รายการ bootstrap admin — ตั้งใน env:
 * `NEXT_PUBLIC_ALLOWED_AUTH_EMAILS=a@x.com,b@y.com` (คั่นด้วย comma)
 *
 * ต้องคงชุดเดียวกับ `isBootstrapAdmin()` ใน `firestore.rules` แล้ว deploy rules ใหม่
 */
function parseAllowedAuthEmailsFromEnv(): readonly string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_AUTH_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Object.freeze(list);
}

export const BOOTSTRAP_ADMIN_EMAILS: readonly string[] =
  parseAllowedAuthEmailsFromEnv();

export function isBootstrapAdminEmail(
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
): boolean {
  if (!email || emailVerified === false) return false;
  if (BOOTSTRAP_ADMIN_EMAILS.length === 0) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAP_ADMIN_EMAILS.some((e) => e === normalized);
}
