/**
 * รายการอีเมลที่อนุญาต — ตั้งใน `.env.local`:
 * `NEXT_PUBLIC_ALLOWED_AUTH_EMAILS=a@x.com,b@y.com` (คั่นด้วย comma)
 *
 * ต้องคงชุดเดียวกับ `isAllowedEmail()` ใน `firestore.rules` แล้ว deploy rules ใหม่
 */
function parseAllowedAuthEmailsFromEnv(): readonly string[] {
  const raw = process.env.NEXT_PUBLIC_ALLOWED_AUTH_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Object.freeze(list);
}

export const ALLOWED_AUTH_EMAILS: readonly string[] =
  parseAllowedAuthEmailsFromEnv();

export function isAllowedAuthEmail(
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
): boolean {
  if (!email || emailVerified === false) return false;
  if (ALLOWED_AUTH_EMAILS.length === 0) return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_AUTH_EMAILS.some((e) => e === normalized);
}
