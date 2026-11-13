// Administración → Estado: the same checks as the health monitor of the Apps Script
// (tools/reminders/apps-script/Salud.gs, which mails the admins), read with admin_salud()
// (migration 20261115130000_salud.sql). Only counts and dates. Keep the limits equal to
// SALUD_LIMITS in Salud.gs.

export const HEALTH_LIMITS = {
  examHours: 36,
  newsHours: 48,
  reminderHours: 3,
  /** The monitor runs every hour: older than this, it stopped. */
  monitorHours: 2,
} as const;

/** One row of admin_salud(). */
export interface Health {
  checkedAt: string;
  examSyncAt: string | null;
  examOldestPlanSyncAt: string | null;
  newsFetchedAt: string | null;
  remindersDue: number;
  remindersDueSince: string | null;
  offersPending: number;
  lastSeenAt: string | null;
  users: number;
  reviews: number;
  monitorCheckedAt: string | null;
}

export interface HealthItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

const H = 60 * 60 * 1000;

/** "hace 5 min", "hace 3 h", "hace 2 días", or "nunca". */
export function ago(iso: string | null, now: number): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "nunca";
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} días`;
}

const hours = (iso: string | null, now: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? Infinity : (now - t) / H;
};

/** The checks, in order, with ✅ / ⚠️ and a short detail. */
export function healthItems(h: Health, now: number): HealthItem[] {
  const L = HEALTH_LIMITS;
  const late = h.remindersDue > 0 && hours(h.remindersDueSince, now) > L.reminderHours;
  return [
    {
      key: "monitor",
      label: "Monitor de la planilla",
      ok: hours(h.monitorCheckedAt, now) <= L.monitorHours,
      detail:
        hours(h.monitorCheckedAt, now) <= L.monitorHours
          ? `Último chequeo del monitor: ${ago(h.monitorCheckedAt, now)}.`
          : `El monitor no está corriendo. Último chequeo: ${ago(h.monitorCheckedAt, now)}.`,
    },
    {
      key: "examenes",
      label: "Fechas de examen del SIU",
      ok: hours(h.examSyncAt, now) <= L.examHours,
      detail:
        `Última lectura del SIU: ${ago(h.examSyncAt, now)}.` +
        (h.examOldestPlanSyncAt ? ` El plan leído hace más tiempo: ${ago(h.examOldestPlanSyncAt, now)}.` : ""),
    },
    {
      key: "noticias",
      label: "Noticias de la FIUBA",
      ok: hours(h.newsFetchedAt, now) <= L.newsHours,
      detail: `Última copia: ${ago(h.newsFetchedAt, now)}.`,
    },
    {
      key: "recordatorios",
      label: "Mails de Recordarme",
      ok: !late,
      detail:
        h.remindersDue === 0
          ? "Ninguno pendiente."
          : `${h.remindersDue} por mandar; el más viejo tenía que salir ${ago(h.remindersDueSince, now)}.`,
    },
  ];
}

/** A row of admin_salud() as Health. */
export function toHealth(r: Record<string, unknown>): Health {
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
  return {
    checkedAt: s("checked_at") ?? new Date().toISOString(),
    examSyncAt: s("exam_sync_at"),
    examOldestPlanSyncAt: s("exam_oldest_plan_sync_at"),
    newsFetchedAt: s("news_fetched_at"),
    remindersDue: Number(r.reminders_due ?? 0),
    remindersDueSince: s("reminders_due_since"),
    offersPending: Number(r.offers_pending ?? 0),
    lastSeenAt: s("last_seen_at"),
    users: Number(r.users ?? 0),
    reviews: Number(r.reviews ?? 0),
    monitorCheckedAt: s("monitor_checked_at"),
  };
}
