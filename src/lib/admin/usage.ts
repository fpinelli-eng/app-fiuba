// Administración → Uso: how the app is used and how the server is doing, read with admin_uso()
// (migration 20261118150000_admin_uso.sql) when the page loads. Only counts, dates and table names.
// Pure helpers (formatting and shaping the series), tested in usage.test.ts.

const TZ = "America/Argentina/Buenos_Aires";

/** The public site, checked with a HEAD request on each visit to the page. */
export const SITE_URL = "https://fiubi.com.ar";

export interface SiteCheck {
  ok: boolean;
  status: number | null;
  ms: number | null;
}

export interface Peak {
  users: number;
  at: string;
}

export interface Usage {
  checkedAt: string;
  onlineNow: number;
  active24h: number;
  active7d: number;
  active30d: number;
  users: number;
  byCareer: { name: string; users: number; noPlan: boolean }[];
  peakToday: Peak | null;
  peak7d: Peak | null;
  /** Last 24 hours, oldest first: the most students at the same time in each hour. */
  hourly: { at: string; users: number }[];
  /** Last 14 days, oldest first (YYYY-MM-DD, Buenos Aires): students who used the app that day. */
  daily: { day: string; users: number }[];
  dbBytes: number;
  dbLimitBytes: number;
  tables: { name: string; bytes: number }[];
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

function peak(v: unknown): Peak | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return num(r.users) > 0 && str(r.at) ? { users: num(r.users), at: str(r.at) } : null;
}

/** The jsonb of admin_uso() as Usage. */
export function toUsage(r: Record<string, unknown>): Usage {
  return {
    checkedAt: str(r.checked_at) || new Date().toISOString(),
    onlineNow: num(r.online_now),
    active24h: num(r.active_24h),
    active7d: num(r.active_7d),
    active30d: num(r.active_30d),
    users: num(r.users),
    byCareer: list(r.by_career).map((c) => ({ name: str(c.name), users: num(c.users), noPlan: c.no_plan === true })),
    peakToday: peak(r.peak_today),
    peak7d: peak(r.peak_7d),
    hourly: list(r.hourly).map((h) => ({ at: str(h.at), users: num(h.users) })),
    daily: list(r.daily).map((d) => ({ day: str(d.day), users: num(d.users) })),
    dbBytes: num(r.db_bytes),
    dbLimitBytes: num(r.db_limit_bytes) || 500 * 1024 * 1024,
    tables: list(r.tables).map((t) => ({ name: str(t.name), bytes: num(t.bytes) })),
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

/** Bars of a chart: the height of each one, 0–100, against the biggest (at least 1, so an empty chart stays flat). */
export function barHeights(values: number[]): { max: number; heights: number[] } {
  const max = Math.max(1, ...values);
  return { max, heights: values.map((v) => percent(v, max)) };
}

/** "14 h" (Buenos Aires) for an instant. */
export function hourLabel(iso: string): string {
  const h = new Date(iso).toLocaleString("es-AR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });
  return `${Number(h)} h`;
}

/** "14:35" (Buenos Aires). */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

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

/** When a peak happened: "a las 14:35" today, "el mar 17/11 a las 19:10" another day. */
export function peakWhen(p: Peak, now: string): string {
  const day = buenosAiresDay(p.at);
  const time = `a las ${timeLabel(p.at)}`;
  return day === buenosAiresDay(now) ? time : `el ${dayLabel(day)} ${time}`;
}

/** Response time of a check: fast, slow or failed. */
export function latencyLevel(ms: number | null, ok = true): Level {
  if (!ok || ms === null) return "bad";
  return ms < 800 ? "ok" : ms < 2000 ? "warn" : "bad";
}

/** "1 alumno", "3 alumnos". */
export function students(n: number): string {
  return `${n.toLocaleString("es-AR")} ${n === 1 ? "alumno" : "alumnos"}`;
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
