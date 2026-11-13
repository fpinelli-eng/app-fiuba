// Pure logic of the Novedades section (unit tested): the academic calendar around "today",
// date labels and the validation of an aviso. No database access: client components can import it.

/** A row of academic_events: dates are "YYYY-MM-DD" (Monday to Saturday of the weeks). */
export interface AcademicEvent {
  id: number;
  title: string;
  startsOn: string;
  endsOn: string;
  sort: number;
  /** True for a calendar date (a run of weeks, made at the start of the year), false once confirmed. */
  tentative?: boolean;
  /** Where a confirmed date comes from ("Mail de la Secretaría del 29/10"). */
  note?: string | null;
}

/** A row of academic_date_confirmations: the real date of a calendar row (replaces) or a new one. */
export interface DateConfirmation {
  id: number;
  title: string;
  startsOn: string;
  endsOn: string;
  note: string;
  replaces: number | null;
}

// The calendar rows that matter to most students (Francisco, 12 Nov 2026): classes, partial and
// final exams, enrollments and the summer courses. Not the paperwork few people do (convalidación,
// simultaneidad, movilidad, prórrogas…). Checked against the titles of the PDF (TITLES in
// tools/calendar/extract.py): update both if a new calendar renames a row.
const IMPORTANT = [
  /^Período de Clases$/,
  /^Evaluaciones Parciales/,
  /^Evaluaciones Integradoras$/,
  /^Inscripción para Evaluaciones Integradoras$/,
  /^Publicación de oferta horaria/,
  /^Publicación de Prioridades/,
  /^Inscripción para Cursar/,
  /^Desinscripción de Asignaturas$/,
  /Cursos de Verano/i,
];

export const isImportantDate = (title: string) => IMPORTANT.some((re) => re.test(title));

/**
 * The dates of Novedades: the important calendar rows, tentative, except the ones a confirmation
 * replaces, plus every confirmation (an admin chose it, so it shows even if its title is not in the
 * list). A confirmation keeps the id of the row it replaces (and its place in the PDF), a new date
 * gets a negative id, so ids stay unique.
 */
export function importantDates(events: AcademicEvent[], confirmations: DateConfirmation[]): AcademicEvent[] {
  const sortOf = new Map(events.map((e) => [e.id, e.sort]));
  const replaced = new Set(confirmations.flatMap((c) => (c.replaces === null ? [] : [c.replaces])));
  const tentative = events
    .filter((e) => !replaced.has(e.id) && isImportantDate(e.title))
    .map((e) => ({ ...e, tentative: true, note: null }));
  const confirmed = confirmations.map((c) => ({
    id: c.replaces ?? -c.id,
    title: c.title,
    startsOn: c.startsOn,
    endsOn: c.endsOn,
    sort: (c.replaces !== null && sortOf.get(c.replaces)) || 0,
    tentative: false,
    note: c.note,
  }));
  return [...tentative, ...confirmed];
}

/**
 * The days of a date: exact when confirmed ("mar 17/11 → mié 18/11"); for a tentative one, the
 * weeks, since that is all the PDF says ("Semana del 9/11", "Del 16/11 al 5/12").
 */
export function formatDateRange(e: Pick<AcademicEvent, "startsOn" | "endsOn" | "tentative">): string {
  if (e.tentative) {
    const short = (d: string) => d.split("-").slice(1).reverse().map(Number).join("/");
    return daysUntil(e.startsOn, e.endsOn) <= 6 ? `Semana del ${short(e.startsOn)}` : `Del ${short(e.startsOn)} al ${short(e.endsOn)}`;
  }
  return e.startsOn === e.endsOn ? formatWeekday(e.startsOn) : `${formatWeekday(e.startsOn)} → ${formatWeekday(e.endsOn)}`;
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

/** A calendar date shown in Novedades, with what it takes to draw it. */
export interface DateHighlight {
  event: AcademicEvent;
  /** Going on today. */
  now: boolean;
  /** now: days until it ends (0 = ends today). Upcoming: days until it starts. */
  days: number;
  /** now: share of the period already gone, from 0 to 1 (today counts). Upcoming: 0. */
  progress: number;
}

/**
 * What Novedades shows of the calendar: what is going on now (the ones that end first first) and
 * what is about to start (the next four weeks first, topped up with what comes later).
 */
export function calendarHighlights(
  groups: CalendarGroups,
  today: string,
  max: { now: number; upcoming: number } = { now: 4, upcoming: 4 },
): { now: DateHighlight[]; upcoming: DateHighlight[] } {
  return {
    now: groups.now.slice(0, max.now).map((event) => {
      const total = daysUntil(event.startsOn, event.endsOn) + 1;
      const gone = daysUntil(event.startsOn, today) + 1;
      return { event, now: true, days: daysUntil(today, event.endsOn), progress: Math.min(1, Math.max(0, gone / total)) };
    }),
    upcoming: [...groups.soon, ...groups.later]
      .slice(0, max.upcoming)
      .map((event) => ({ event, now: false, days: daysUntil(today, event.startsOn), progress: 0 })),
  };
}

/**
 * "Termina hoy", "Termina mañana", "Quedan 3 días", "Quedan 2 semanas". Tentative dates are weeks:
 * "Termina esta semana" instead of a day count.
 */
export function formatRemaining(days: number, tentative = false): string {
  if (tentative && days < 7) return "Termina esta semana";
  if (days <= 0) return "Termina hoy";
  if (days === 1) return "Termina mañana";
  if (days < 14) return `Quedan ${days} días`;
  return `Quedan ${Math.round(days / 7)} semanas`;
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

/**
 * "Mañana", "En 3 días", "En 2 semanas". A tentative date starts on a Monday that may move: within
 * a week it is "La semana que viene", never a day count.
 */
export function formatCountdown(days: number, tentative = false): string {
  if (tentative && days > 0 && days <= 7) return "La semana que viene";
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

export const NOTE_MAX = 140;

export type ConfirmationDraft = { title: string; startsOn: string; endsOn: string; note: string; replaces: number | null };

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

/** Checks a confirmed date from the admin form: the draft to save, or the error to show. */
export function validateConfirmation(input: {
  title: unknown;
  startsOn: unknown;
  endsOn: unknown;
  note: unknown;
  replaces: unknown;
}): { draft: ConfirmationDraft; error?: undefined } | { error: string; draft?: undefined } {
  const title = String(input.title ?? "").trim();
  const startsOn = String(input.startsOn ?? "").trim();
  const endsOn = String(input.endsOn ?? "").trim() || startsOn;
  const note = String(input.note ?? "").trim();
  const raw = String(input.replaces ?? "").trim();
  const replaces = raw ? Number(raw) : null;
  if (!title) return { error: "Escribí qué trámite es." };
  if (title.length > TITLE_MAX) return { error: `El trámite puede tener hasta ${TITLE_MAX} caracteres.` };
  if (!isDay(startsOn)) return { error: "Elegí el día en que empieza." };
  if (!isDay(endsOn)) return { error: "Elegí el día en que termina." };
  if (endsOn < startsOn) return { error: "Termina antes de empezar: revisá las fechas." };
  if (!note) return { error: "Escribí de dónde sale la fecha, por ejemplo «Mail de la Secretaría del 29/10»." };
  if (note.length > NOTE_MAX) return { error: `El origen puede tener hasta ${NOTE_MAX} caracteres.` };
  if (replaces !== null && !(Number.isInteger(replaces) && replaces > 0)) return { error: "Elegí el trámite de nuevo." };
  return { draft: { title, startsOn, endsOn, note, replaces } };
}
