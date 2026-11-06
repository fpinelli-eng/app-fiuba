// Pure logic of the Novedades section (unit tested): the academic calendar around "today",
// date labels and the validation of an aviso. No database access: client components can import it.

/** A row of academic_events: dates are "YYYY-MM-DD" (Monday to Saturday of the weeks). */
export interface AcademicEvent {
  id: number;
  title: string;
  startsOn: string;
  endsOn: string;
  sort: number;
}

export interface NewsItem {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  pinned: boolean;
  /** ISO timestamp */
  publishedAt: string;
}

/** A featured news item of www.fi.uba.ar (public.fiuba_news, copied by the "Noticias de la FIUBA" workflow). */
export interface FiubaNewsItem {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  /** ISO timestamp */
  publishedAt: string;
}

/**
 * The next calendar dates of Novedades: up to `maxNow` of what is going on now, then what starts
 * soonest (the ones worth a reminder), `max` in all.
 */
export function nextDates(groups: CalendarGroups, max = 5, maxNow = 2): { event: AcademicEvent; now: boolean }[] {
  const upcoming = [...groups.soon, ...groups.later].map((event) => ({ event, now: false }));
  const now = groups.now.slice(0, Math.max(maxNow, max - upcoming.length)).map((event) => ({ event, now: true }));
  return [...now, ...upcoming].slice(0, max);
}

/** "2026-11-09" → { day: "9", month: "nov" } */
export function dateBadge(date: string): { day: string; month: string } {
  const [, m, d] = date.split("-").map(Number);
  return { day: String(d), month: MONTH[m - 1] };
}

/** Whole days from today to date (both "YYYY-MM-DD"). */
export function daysUntil(today: string, date: string): number {
  const t = (s: string) => Date.UTC(...(s.split("-").map(Number) as [number, number, number]));
  return Math.round((t(date) - t(today)) / 86400000);
}

/** "Mañana", "En 3 días", "En 2 semanas". */
export function formatCountdown(days: number): string {
  if (days <= 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days < 14) return `En ${days} días`;
  return `En ${Math.round(days / 7)} semanas`;
}

export interface CalendarGroups {
  /** starts_on <= today <= ends_on, the ones that end first first. */
  now: AcademicEvent[];
  /** Start in the next SOON_DAYS days. */
  soon: AcademicEvent[];
  /** Start later, up to LATER_DAYS days ahead. */
  later: AcademicEvent[];
}

export const SOON_DAYS = 28;
export const LATER_DAYS = 120;

const TZ = "America/Argentina/Buenos_Aires";

/** The date in Buenos Aires ("YYYY-MM-DD") of a moment. */
export function buenosAiresDate(at: Date = new Date()): string {
  return at.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** "2026-11-02" + 28 → "2026-11-30" */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const byStart = (a: AcademicEvent, b: AcademicEvent) =>
  a.startsOn.localeCompare(b.startsOn) || a.sort - b.sort || a.id - b.id;

/** Splits the calendar into "Ahora", "Próximamente" and "Más adelante" for a given day. */
export function groupCalendar(events: AcademicEvent[], today: string): CalendarGroups {
  const soonUntil = addDays(today, SOON_DAYS);
  const laterUntil = addDays(today, LATER_DAYS);
  const groups: CalendarGroups = { now: [], soon: [], later: [] };
  for (const e of events) {
    if (e.startsOn <= today && today <= e.endsOn) groups.now.push(e);
    else if (e.startsOn > today && e.startsOn <= soonUntil) groups.soon.push(e);
    else if (e.startsOn > soonUntil && e.startsOn <= laterUntil) groups.later.push(e);
  }
  groups.now.sort((a, b) => a.endsOn.localeCompare(b.endsOn) || a.sort - b.sort || a.id - b.id);
  groups.soon.sort(byStart);
  groups.later.sort(byStart);
  return groups;
}

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-28" → "sáb 28/11" */
export function formatWeekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
}

/** Publication date of an aviso, in Buenos Aires: "2 nov" (with the year when it is not the current one). */
export function formatNewsDate(publishedAt: string, today: string): string {
  const date = buenosAiresDate(new Date(publishedAt));
  const [y, m, d] = date.split("-").map(Number);
  const label = `${d} ${MONTH[m - 1]}`;
  return String(y) === today.slice(0, 4) ? label : `${label} ${y}`;
}

/** Pinned first, then the newest. */
export function sortNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() ||
      b.id - a.id,
  );
}

export const TITLE_MAX = 140;
export const BODY_MAX = 2000;
export const URL_MAX = 500;

export type NewsDraft = { title: string; body: string | null; url: string | null };

/** Checks an aviso from the admin form: the draft to save, or the error to show. */
export function validateNews(input: {
  title: unknown;
  body: unknown;
  url: unknown;
}): { draft: NewsDraft; error?: undefined } | { error: string; draft?: undefined } {
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  const url = String(input.url ?? "").trim();
  if (!title) return { error: "Escribí un título." };
  if (title.length > TITLE_MAX) return { error: `El título puede tener hasta ${TITLE_MAX} caracteres.` };
  if (body.length > BODY_MAX) return { error: `El texto puede tener hasta ${BODY_MAX} caracteres.` };
  if (url) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:") || url.length > URL_MAX) {
      return { error: "El enlace tiene que ser una dirección web completa, que empiece con https://." };
    }
  }
  return { draft: { title, body: body || null, url: url || null } };
}
