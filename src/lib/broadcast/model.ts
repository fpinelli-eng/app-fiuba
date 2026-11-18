// Pure logic of the two ways to reach students without mail limits (unit tested): the aviso on
// Inicio and the web push notifications. No database access: client components can import it.
//
// While Tomás and Francisco try them, only admins see either one. The database enforces it too
// (supabase/migrations/20261118120000_avisos_push.sql); opening them takes both changes.
export const OPEN_TO_EVERYONE = false;

export const canUseBroadcasts = (account: { isAdmin: boolean }) => OPEN_TO_EVERYONE || account.isAdmin;

/** The table or function is not in the database yet (Vercel previews use production until merge). */
export const NOT_YET = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);

export const ANNOUNCEMENT_TITLE_MAX = 80;
export const ANNOUNCEMENT_BODY_MAX = 280;
export const PUSH_TITLE_MAX = 60;
export const PUSH_BODY_MAX = 160;
export const URL_MAX = 500;

export interface Announcement {
  id: number;
  title: string;
  body: string;
  url: string | null;
  /** careers.id ('industrial'); null for every career. */
  careerId: string | null;
  /** ISO timestamp; null until it is deleted. */
  endsAt: string | null;
  createdAt: string;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/**
 * An optional link: a path of the app ("/finales") or an https address. Anything else (javascript:,
 * http:, "//other.site") is refused: the link ends up in a card and in a notification.
 */
export function cleanUrl(v: unknown): { url: string | null } | { error: string } {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return { url: null };
  if (raw.length > URL_MAX) return { error: "El enlace es demasiado largo." };
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return { url: raw };
  try {
    const u = new URL(raw);
    if (u.protocol === "https:") return { url: u.href };
  } catch {}
  return { error: "El enlace tiene que empezar con https:// o con / (una sección de FIUBI, como /finales)." };
}

/** "YYYY-MM-DD" → the end of that day in Buenos Aires (UTC−3, no daylight saving time). */
export const endOfDayBuenosAires = (date: string) => new Date(`${date}T23:59:59.999-03:00`).toISOString();

export interface AnnouncementDraft {
  title: string;
  body: string;
  url: string | null;
  career_id: string | null;
  ends_at: string | null;
}

export function validateAnnouncement(
  input: { title: unknown; body: unknown; url: unknown; careerId: unknown; endsOn: unknown },
  careers: string[],
  now: Date,
): { draft: AnnouncementDraft; error?: undefined } | { error: string } {
  const title = text(input.title);
  const body = text(input.body);
  if (!title) return { error: "Escribí un título." };
  if (title.length > ANNOUNCEMENT_TITLE_MAX) return { error: `El título tiene que tener hasta ${ANNOUNCEMENT_TITLE_MAX} caracteres.` };
  if (!body) return { error: "Escribí el texto del aviso." };
  if (body.length > ANNOUNCEMENT_BODY_MAX) return { error: `El texto tiene que tener hasta ${ANNOUNCEMENT_BODY_MAX} caracteres.` };
  const link = cleanUrl(input.url);
  if ("error" in link) return { error: link.error };
  const career = text(input.careerId) || null;
  if (career !== null && !careers.includes(career)) return { error: "Esa carrera no existe." };
  const endsOn = text(input.endsOn);
  let endsAt: string | null = null;
  if (endsOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || Number.isNaN(Date.parse(`${endsOn}T00:00:00Z`))) return { error: "La fecha no es válida." };
    endsAt = endOfDayBuenosAires(endsOn);
    if (Date.parse(endsAt) <= now.getTime()) return { error: "La fecha de fin ya pasó." };
  }
  return { draft: { title, body, url: link.url, career_id: career, ends_at: endsAt } };
}

export const isActive = (a: Pick<Announcement, "endsAt">, now: Date) => a.endsAt === null || Date.parse(a.endsAt) > now.getTime();

/** The aviso a viewer sees on Inicio: the newest active one for their career that they did not close. */
export function pickAnnouncement(list: Announcement[], careerId: string | null, dismissed: number[], now: Date): Announcement | null {
  const closed = new Set(dismissed);
  return (
    list
      .filter((a) => isActive(a, now) && !closed.has(a.id) && (a.careerId === null || a.careerId === careerId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)[0] ?? null
  );
}

// Closed avisos live in a cookie of the browser (Inicio reads it on the server, so a closed aviso
// never flashes). Only ids, the latest few.
export const DISMISSED_COOKIE = "avisos_cerrados";
const DISMISSED_KEEP = 20;

export function parseDismissed(value: string | undefined | null): number[] {
  if (!value) return [];
  return value
    .split(".")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(-DISMISSED_KEEP);
}

export function addDismissed(value: string | undefined | null, id: number): string {
  const ids = parseDismissed(value).filter((n) => n !== id);
  return [...ids, id].slice(-DISMISSED_KEEP).join(".");
}

// Push ------------------------------------------------------------------------------------------

export interface PushDraft {
  title: string;
  body: string;
  url: string;
  careerId: string | null;
}

export function validatePush(input: { title: unknown; body: unknown; url: unknown; careerId: unknown }, careers: string[]): { draft: PushDraft; error?: undefined } | { error: string } {
  const title = text(input.title);
  const body = text(input.body);
  if (!title) return { error: "Escribí un título." };
  if (title.length > PUSH_TITLE_MAX) return { error: `El título tiene que tener hasta ${PUSH_TITLE_MAX} caracteres.` };
  if (body.length > PUSH_BODY_MAX) return { error: `El texto tiene que tener hasta ${PUSH_BODY_MAX} caracteres.` };
  const link = cleanUrl(input.url);
  if ("error" in link) return { error: link.error };
  const career = text(input.careerId) || null;
  if (career !== null && !careers.includes(career)) return { error: "Esa carrera no existe." };
  return { draft: { title, body, url: link.url ?? "/", careerId: career } };
}

/** What the service worker (public/sw.js) receives. Small: push services cap it near 4 KB. */
export function buildPushPayload(d: Pick<PushDraft, "title" | "body" | "url">, tag = "fiubi-aviso"): string {
  return JSON.stringify({ title: d.title, body: d.body, url: d.url, tag });
}

/** The push service says that browser is gone (turned off or uninstalled): delete it. */
export const isGoneStatus = (status: number | undefined) => status === 404 || status === 410;

/** Devices a notification reaches: everyone, or one career. */
export function countReach(counts: { careerId: string | null; devices: number }[], careerId: string | null): number {
  return counts.filter((c) => careerId === null || c.careerId === careerId).reduce((a, c) => a + c.devices, 0);
}

// The "Activar notificaciones" control -----------------------------------------------------------

export type PushState =
  | "unsupported" // the browser has no web push
  | "ios-install" // iPhone or iPad in Safari: push only works with the app on the home screen (iOS 16.4+)
  | "ios-old" // installed, but an iOS older than 16.4
  | "unconfigured" // no VAPID key on the server
  | "denied" // the person blocked notifications for the site
  | "off"
  | "on";

export interface PushEnvironment {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  /** iOS version as major × 100 + minor (16.4 → 1604), null when unknown. */
  iosVersion: number | null;
  standalone: boolean;
  configured: boolean;
  permission: "default" | "granted" | "denied";
  subscribed: boolean;
}

export function pushState(env: PushEnvironment): PushState {
  if (env.isIOS && !env.standalone) return "ios-install";
  if (env.isIOS && env.iosVersion !== null && env.iosVersion < 1604) return "ios-old";
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return env.isIOS ? "ios-old" : "unsupported";
  if (!env.configured) return "unconfigured";
  if (env.permission === "denied") return "denied";
  return env.subscribed && env.permission === "granted" ? "on" : "off";
}

/** iPhone, iPod or iPad (iPadOS says "Macintosh" but has touch). Version from "OS 17_2". */
export function detectIOS(userAgent: string, maxTouchPoints: number): { isIOS: boolean; version: number | null } {
  const iDevice = /iPhone|iPad|iPod/.test(userAgent);
  const iPadOS = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  if (!iDevice && !iPadOS) return { isIOS: false, version: null };
  const m = /OS (\d+)[_.](\d+)/.exec(userAgent);
  const v = /Version\/(\d+)\.(\d+)/.exec(userAgent);
  const parts = iDevice ? m : (v ?? m);
  return { isIOS: true, version: parts ? Number(parts[1]) * 100 + Number(parts[2]) : null };
}

/** The VAPID public key (base64url) as the bytes PushManager.subscribe wants. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
