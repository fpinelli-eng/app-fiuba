// Administración → Usuarios: people who came in each hour, from admin_uso().by_hour
// (20261121170000_uso_por_hora.sql). Approximate: touch_last_seen() counts a student at most once per
// hour, in the hour of their first visit. Pure helpers, tested in by-hour.test.ts.

const TZ = "America/Argentina/Buenos_Aires";

export interface HourCount {
  /** Start of the hour (ISO). */
  hour: string;
  users: number;
}

export interface DayCount {
  /** Buenos Aires day, "2026-11-21". */
  day: string;
  /** Busiest hour of the day. */
  peak: number;
  /** Sum of the hours (a student who came in several hours counts in each one). */
  total: number;
}

export interface ByHour {
  /** The last 24 hours, oldest first (the last one is the current hour). */
  hours: HourCount[];
  /** The last 14 days, oldest first (the last one is today). */
  days: DayCount[];
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** admin_uso().by_hour as ByHour, or null if it wasn't sent (admin_uso() before 20261121170000) or is empty. */
export function toByHour(v: unknown): ByHour | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const hours = list(r.hours)
    .map((h) => ({ hour: str(h.hour), users: Math.max(0, num(h.users)) }))
    .filter((h) => !Number.isNaN(Date.parse(h.hour)));
  const days = list(r.days)
    .map((d) => ({ day: str(d.day).slice(0, 10), peak: Math.max(0, num(d.peak)), total: Math.max(0, num(d.total)) }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day));
  if (hours.length === 0 && days.length === 0) return null;
  return { hours, days };
}

/** The index of the largest value (the most recent one on a tie), or -1 if every value is 0. */
export function peakIndex(values: number[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (v > 0 && (best < 0 || v >= values[best])) best = i;
  });
  return best;
}

/** "2026-11-21T17:00:00Z" → "14 h" (Buenos Aires). */
export function hourLabel(iso: string): string {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return `${Number(h)} h`;
}

/** "2026-11-21T17:00:00Z" → "14 a 15 h" (Buenos Aires). */
export function hourRangeLabel(iso: string): string {
  const start = Number(hourLabel(iso).split(" ")[0]);
  return `${start} a ${(start + 1) % 24} h`;
}
