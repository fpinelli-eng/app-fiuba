// "Recordarme" in Finales: pure logic shared by the app and the sender bot (tools/reminders/,
// workflow "Recordatorios"). No database, no network. Runs in Node with type stripping, so only
// type annotations: no enums, no path aliases, relative imports only.
//
// Moments are Buenos Aires time as "YYYY-MM-DDTHH:MM" (exam_tables stores them that way), so they
// compare as strings.

/**
 * What identifies an exam table across the daily SIU sync, which replaces the rows of
 * exam_tables (new ids): the same key tools/exams uses to compare rows, plus the plan.
 */
export interface ReminderKey {
  planId: string;
  /** SIU subject code: "CB002" */
  code: string;
  /** Table name: "MESA 01", "Mesa 1 Surace" */
  name: string;
  /** "Regular", "Libre"… */
  kind: string;
  /** Exam day, "YYYY-MM-DD" */
  date: string;
}

export function reminderKey(k: ReminderKey): string {
  return [k.planId, k.code, k.name, k.kind, k.date].join("\u0000");
}

/** A reminder of the student, for the Finales screen (snapshot of when they asked). */
export interface ExamReminderView extends ReminderKey {
  id: number;
  subjectName: string;
  startTime: string | null;
  enrollFrom: string | null;
  enrollTo: string | null;
}

/** An exam table as it is now in exam_tables (only what the reminders need). */
export interface CurrentTable extends ReminderKey {
  enrollFrom: string | null;
  enrollTo: string | null;
  startTime: string | null;
  endTime: string | null;
}

/**
 * The current table of each key. The SIU may list one key twice (it should not): then the widest
 * enrollment window wins, so no deadline is announced earlier than the real one.
 */
export function currentTablesByKey(tables: CurrentTable[]): Map<string, CurrentTable> {
  const out = new Map<string, CurrentTable>();
  for (const t of tables) {
    const key = reminderKey(t);
    const prev = out.get(key);
    if (!prev) {
      out.set(key, t);
      continue;
    }
    out.set(key, {
      ...prev,
      enrollFrom: minMoment(prev.enrollFrom, t.enrollFrom),
      enrollTo: maxMoment(prev.enrollTo, t.enrollTo),
    });
  }
  return out;
}

const minMoment = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a < b ? a : b);
const maxMoment = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a > b ? a : b);

/** Buenos Aires time of a Date as "YYYY-MM-DDTHH:MM". */
export function buenosAiresMoment(date: Date): string {
  return date
    .toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })
    .replace(" ", "T")
    .slice(0, 16);
}

/** Mails are not sent before this hour (Buenos Aires). */
export const SEND_FROM = "08:00";

/** "2026-03-01" → "2026-02-28" */
export function previousDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * The day of the "último día" mail. The SIU closes many tables at 23:59, but some close in the
 * morning (09:00) or at 00:00: then the last useful day is the day before.
 */
export function lastEnrollDay(enrollTo: string): string {
  const [day, time = "23:59"] = enrollTo.split("T");
  return time < "12:00" ? previousDay(day) : day;
}

export type ReminderMailKind = "first" | "last";

export interface ReminderState {
  /** When the student asked, Buenos Aires time. */
  createdAt: string;
  firstSent: boolean;
  lastSent: boolean;
}

/**
 * Which mail is due now for a reminder, given its table as it is now (null: the table is no longer
 * in the SIU, so nothing is sent and the reminder stays).
 *
 * - "first": once the enrollment opened, from 08:00 of its first day (never before it opens). Not
 *   when the student asked with the enrollment already open: they already know.
 * - "last": on the last day (see lastEnrollDay()), from 08:00 and while it is still open. If the
 *   first mail is still pending by then (short window, late reminder, the bot was down), only this
 *   one goes and it counts for both.
 */
export function dueMail(r: ReminderState, table: Pick<CurrentTable, "enrollFrom" | "enrollTo"> | null, now: string): ReminderMailKind | null {
  if (!table || !table.enrollTo || r.lastSent) return null;
  const { enrollFrom, enrollTo } = table;
  if (now >= enrollTo) return null;
  if (enrollFrom && now < enrollFrom) return null;

  const lastFrom = `${lastEnrollDay(enrollTo)}T${SEND_FROM}`;
  if (now >= lastFrom) return "last";

  if (r.firstSent || !enrollFrom) return null;
  if (r.createdAt >= enrollFrom) return null;
  const firstFrom = `${enrollFrom.slice(0, 10)}T${SEND_FROM}`;
  return now >= firstFrom ? "first" : null;
}
