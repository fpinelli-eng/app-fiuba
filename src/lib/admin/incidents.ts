import { buenosAiresDay, dayLabel, timeLabel } from "./usage";

// Administración → Estado: the latency samples and the incident history that the health monitor of
// the Apps Script (tools/reminders/apps-script/Salud.gs) records with salud_registrar(), read with
// admin_monitor() (migration 20261121120000_incidentes.sql). Pure helpers, tested in incidents.test.ts.

/** Slower than this is "La base está lenta". Keep equal to SALUD_LIMITS.slowMs in Salud.gs. */
export const SLOW_MS = 3000;
/** The database keeps the last 72 hourly samples. */
export const LATENCY_HOURS = 72;

export type IncidentKind = "db_down" | "db_slow" | "site_down" | "other";

export interface Incident {
  id: number;
  kind: IncidentKind;
  title: string;
  detail: string | null;
  startedAt: string;
  /** null while it goes on. */
  endedAt: string | null;
  maxMs: number | null;
}

export interface LatencySample {
  at: string;
  ms: number;
}

export interface MonitorHistory {
  checkedAt: string;
  latency: LatencySample[];
  /** Newest first. */
  incidents: Incident[];
}

const KINDS: readonly IncidentKind[] = ["db_down", "db_slow", "site_down", "other"];
const H = 60 * 60 * 1000;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** The jsonb of admin_monitor(). */
export function toMonitorHistory(r: Record<string, unknown>): MonitorHistory {
  return {
    checkedAt: str(r.checked_at) || new Date().toISOString(),
    latency: list(r.latency)
      .map((s) => ({ at: str(s.at), ms: numOrNull(s.ms) }))
      .filter((s): s is LatencySample => s.at !== "" && s.ms !== null && !Number.isNaN(Date.parse(s.at))),
    incidents: list(r.incidents)
      .map((i) => ({
        id: Number(i.id ?? 0),
        kind: (KINDS as readonly string[]).includes(str(i.kind)) ? (str(i.kind) as IncidentKind) : "other",
        title: str(i.title),
        detail: str(i.detail) || null,
        startedAt: str(i.started_at),
        endedAt: str(i.ended_at) || null,
        maxMs: numOrNull(i.max_ms),
      }))
      .filter((i) => i.startedAt !== "")
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
  };
}

export interface LatencySlot {
  /** Start of the hour this slot covers (ms since epoch). */
  start: number;
  /** The slowest sample in that hour, or null if the monitor got none (it did not run or the database did not answer). */
  ms: number | null;
}

/** The last `hours` hours, oldest first, one slot per hour ending at now. */
export function latencySlots(samples: readonly LatencySample[], now: number, hours = LATENCY_HOURS): LatencySlot[] {
  const first = now - hours * H;
  const slots: LatencySlot[] = Array.from({ length: hours }, (_, i) => ({ start: first + i * H, ms: null }));
  for (const s of samples) {
    const t = Date.parse(s.at);
    if (!(t > first && t <= now)) continue;
    const i = Math.min(hours - 1, Math.floor((t - first) / H));
    slots[i].ms = Math.max(slots[i].ms ?? 0, s.ms);
  }
  return slots;
}

/** The top of the chart: at least 6 s (so the 3 s line sits in the middle), rounded up to whole seconds. */
export function chartTop(slots: readonly LatencySlot[]): number {
  const max = Math.max(0, ...slots.map((s) => s.ms ?? 0));
  return Math.max(2 * SLOW_MS, Math.ceil(max / 1000) * 1000);
}

/** Summary for the chart: median and maximum of the samples there are, and how many hours went over SLOW_MS. */
export function latencySummary(slots: readonly LatencySlot[]): { median: number | null; max: number | null; slow: number; missing: number } {
  const values = slots.flatMap((s) => (s.ms === null ? [] : [s.ms])).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor((values.length - 1) / 2)] : null;
  return {
    median,
    max: values.length ? values[values.length - 1] : null,
    slow: values.filter((v) => v > SLOW_MS).length,
    missing: slots.length - values.length,
  };
}

/** 412 → "0,4 s", 12345 → "12,3 s". */
export function secondsLabel(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

/** "menos de 1 min", "45 min", "2 h 15 min", "3 días 4 h". */
export function durationLabel(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "día" : "días"}${h % 24 ? ` ${h % 24} h` : ""}`;
}

/** How long it lasted, or has lasted so far if it goes on. */
export function incidentDuration(i: Incident, now: number): string {
  const end = i.endedAt ? Date.parse(i.endedAt) : now;
  return durationLabel(end - Date.parse(i.startedAt));
}

/** "jue 19/11 14:35" (Buenos Aires). */
export function dateTimeLabel(iso: string): string {
  return `${dayLabel(buenosAiresDay(iso))} ${timeLabel(iso)}`;
}

/** The cause in a few words. */
export const KIND_LABEL: Record<IncidentKind, string> = {
  db_down: "Base caída",
  db_slow: "Base lenta",
  site_down: "Sitio caído",
  other: "Otro chequeo",
};
