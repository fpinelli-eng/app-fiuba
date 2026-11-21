// Administración → Usuarios: how the app is used, how big the database is and who the students are,
// read with one call to admin_uso() (migration 20261119180000_menos_escrituras.sql) when the page loads.
// Pure helpers (formatting and shaping the jsonb), tested in usage.test.ts.

import { toByHour, type ByHour } from "./by-hour";

const TZ = "America/Argentina/Buenos_Aires";

/** The public site, checked with a HEAD request on each visit to the page. */
export const SITE_URL = "https://fiubi.com.ar";

export interface SiteCheck {
  ok: boolean;
  status: number | null;
  ms: number | null;
}

/** One student, for the table of Administración → Usuarios. */
export interface AdminUser {
  fullName: string;
  email: string;
  planId: string | null;
  /** "Ing. Industrial 2023", or null if admin_uso() didn't send it (older version) or there is no plan. */
  plan: string | null;
  createdAt: string;
  introSeen: boolean;
  /** Subjects marked as approved in the map. */
  subjects: number;
  planCourses: number;
  /** How they arrived before signing up ("qr": the printed QR), or null if unknown. */
  signupSource: string | null;
  /**
   * Last use of the app (profiles.last_seen_at, recorded at most hourly, or else the last sign-in),
   * or null if unknown or admin_uso() didn't send it (before 20261121150000).
   */
  lastSeen: string | null;
}

export interface Usage {
  checkedAt: string;
  active24h: number;
  active7d: number;
  active30d: number;
  users: number;
  /** id and active7d are null if admin_uso() didn't send them (before 20261120180000) or for "Sin plan" (id). */
  byCareer: { id: string | null; name: string; users: number; active7d: number | null; noPlan: boolean }[];
  dbBytes: number;
  dbLimitBytes: number;
  /** Students with at least one visible review (null: not sent, older admin_uso()). */
  reviewAuthors: number | null;
  /** The students, newest first (null: not sent, older admin_uso(); read them with admin_users()). */
  people: AdminUser[] | null;
  /** People who came in each hour, approximate (null: not sent, admin_uso() before 20261121170000). */
  byHour: ByHour | null;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/**
 * A row of admin_uso().people or of admin_users() as AdminUser. Extra fields are ignored, like the
 * last_seen_at of admin_users(), which is rounded to the day: only the exact last_seen of admin_uso() is read.
 */
export function toAdminUser(u: Record<string, unknown>): AdminUser {
  return {
    fullName: str(u.full_name),
    email: str(u.email),
    planId: str(u.plan_id) || null,
    plan: str(u.plan) || null,
    createdAt: str(u.created_at),
    introSeen: u.intro_seen === true,
    subjects: num(u.subjects),
    planCourses: num(u.plan_courses),
    signupSource: str(u.signup_source) || null,
    lastSeen: str(u.last_seen) || null,
  };
}

/** The jsonb of admin_uso() as Usage. Tolerates the older shape (20261118150000): its extra fields are ignored. */
export function toUsage(r: Record<string, unknown>): Usage {
  return {
    checkedAt: str(r.checked_at) || new Date().toISOString(),
    active24h: num(r.active_24h),
    active7d: num(r.active_7d),
    active30d: num(r.active_30d),
    users: num(r.users),
    byCareer: list(r.by_career).map((c) => ({
      id: str(c.id) || null,
      name: str(c.name),
      users: num(c.users),
      active7d: c.active_7d === undefined || c.active_7d === null ? null : num(c.active_7d),
      noPlan: c.no_plan === true,
    })),
    dbBytes: num(r.db_bytes),
    dbLimitBytes: num(r.db_limit_bytes) || 500 * 1024 * 1024,
    reviewAuthors: r.review_authors === undefined || r.review_authors === null ? null : num(r.review_authors),
    people: Array.isArray(r.people) ? list(r.people).map(toAdminUser) : null,
    byHour: toByHour(r.by_hour),
  };
}

/** 1536 → "1,5 kB", 52428800 → "50 MB" (powers of 1024, like Supabase). */
export function formatBytes(bytes: number): string {
  const units = ["B", "kB", "MB", "GB", "TB"];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : 1;
  return `${v.toLocaleString("es-AR", { maximumFractionDigits: digits })} ${units[i]}`;
}

/** Share of a total, 0–100. */
export function percent(part: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

/** 3.14 → "3,1 %", 0.04 → "menos de 0,1 %", 42 → "42 %". */
export function formatPercent(p: number): string {
  if (p > 0 && p < 0.1) return "menos de 0,1 %";
  return `${p.toLocaleString("es-AR", { maximumFractionDigits: p < 10 ? 1 : 0 })} %`;
}

export type Level = "ok" | "warn" | "bad";

/** Free plan of Supabase: warn from 70 %, alarm from 90 %. */
export function storageLevel(p: number): Level {
  return p >= 90 ? "bad" : p >= 70 ? "warn" : "ok";
}

/** "14:35" (Buenos Aires). */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** "2026-11-19T03:05:00Z" → "19/11/2026 00:05" (Buenos Aires, always the full date: never "hoy" or "ayer"); null → "—". */
export function dateTimeLabel(iso: string | null): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

const WEEKDAY =["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "2026-11-17" → "mar 17/11". */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d}/${m}`;
}

/** "2026-11-17T22:10:00Z" → "2026-11-17" (Buenos Aires). */
export function buenosAiresDay(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** Response time of a check: fast, slow or failed. */
export function latencyLevel(ms: number | null, ok = true): Level {
  if (!ok || ms === null) return "bad";
  return ms < 800 ? "ok" : ms < 2000 ? "warn" : "bad";
}

export interface Deployment {
  id: string;
  state: string;
  production: boolean;
  branch: string | null;
  createdAt: number;
}

export type DeploymentsResult =
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ok"; deployments: Deployment[] };

const STATE: Record<string, { label: string; level: Level }> = {
  READY: { label: "Publicado", level: "ok" },
  BUILDING: { label: "Armándose", level: "warn" },
  INITIALIZING: { label: "Arrancando", level: "warn" },
  QUEUED: { label: "En espera", level: "warn" },
  ERROR: { label: "Falló", level: "bad" },
  CANCELED: { label: "Cancelado", level: "warn" },
};

/** "Publicado", "Falló"… for a Vercel deployment state. */
export function deploymentState(state: string): { label: string; level: Level } {
  return STATE[state] ?? { label: state ? state.toLowerCase() : "desconocido", level: "warn" };
}

/** The deployments of the Vercel API (/v6/deployments): only state, target, branch and date. */
export function toDeployments(body: unknown): Deployment[] {
  const rows = body && typeof body === "object" ? list((body as Record<string, unknown>).deployments) : [];
  return rows.map((d) => {
    const meta = (d.meta && typeof d.meta === "object" ? d.meta : {}) as Record<string, unknown>;
    return {
      id: str(d.uid),
      state: str(d.readyState) || str(d.state),
      production: d.target === "production",
      branch: str(meta.githubCommitRef) || null,
      createdAt: num(d.created ?? d.createdAt),
    };
  });
}
