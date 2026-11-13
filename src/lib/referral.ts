// Where a student came from before signing up (?ref=… in the link). Only a fixed list of values is
// accepted: anything else is ignored, so no arbitrary text ends up in a cookie or in the database.
// Pure module (no Next.js imports): the proxy and requireAccount() both use it.

/** Values the app records. The database checks the same list (profiles.signup_source). */
export const SIGNUP_SOURCES = ["qr"] as const;
export type SignupSource = (typeof SIGNUP_SOURCES)[number];

/** First-party cookie the proxy sets when the link has ?ref=qr. */
export const REFERRAL_COOKIE = "fiubi_ref";
export const REFERRAL_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds

/** The whitelisted source, or null for anything else (missing, empty, unknown, different case). */
export function parseRef(value: string | null | undefined): SignupSource | null {
  return (SIGNUP_SOURCES as readonly string[]).includes(value ?? "") ? (value as SignupSource) : null;
}
