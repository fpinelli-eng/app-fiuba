// Types and formatting of the Finales section. No database access: client components import from here.

export interface ExamTableView {
  id: number;
  /** "MESA 01", "Mesa 1 Surace" */
  name: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "Regular", "Libre"… */
  kind: string;
  /** "YYYY-MM-DDTHH:MM", Buenos Aires time. */
  enrollFrom: string | null;
  enrollTo: string | null;
}

export interface ExamSubjectView {
  /** Plan subject id, or the SIU code when the subject is not in the plan's map (e.g. the English test). */
  key: string;
  name: string;
  /** SIU code: "TC010" */
  code: string;
  tables: ExamTableView[];
}

export interface FinalsData {
  /** Now in Buenos Aires, "YYYY-MM-DDTHH:MM". */
  now: string;
  /** Exam dates of the plan were loaded at least once. */
  loaded: boolean;
  /** The student's pending finals (map: "Final pendiente") with their upcoming exam tables. */
  pending: ExamSubjectView[];
  /** Every subject of the plan with upcoming exam tables. */
  all: ExamSubjectView[];
}

export type EnrollmentStatus =
  | { kind: "open"; until: string }
  | { kind: "soon"; from: string }
  | { kind: "closed" }
  | { kind: "unknown" };

/** Enrollment state of an exam table at a given moment (both in Buenos Aires time). */
export function enrollmentStatus(t: Pick<ExamTableView, "enrollFrom" | "enrollTo">, now: string): EnrollmentStatus {
  if (!t.enrollTo) return { kind: "unknown" };
  if (now > t.enrollTo) return { kind: "closed" };
  if (t.enrollFrom && now < t.enrollFrom) return { kind: "soon", from: t.enrollFrom };
  return { kind: "open", until: t.enrollTo };
}

const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** "2026-12-09" → "Mié 9/12" */
export function formatExamDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d}/${m}`;
}

/** "2026-12-07T14:00" → "7/12 14:00" (no time when it is 00:00 or 23:59). */
export function formatEnrollMoment(moment: string): string {
  const [date, time] = moment.split("T");
  const [, m, d] = date.split("-").map(Number);
  return time && time !== "00:00" && time !== "23:59" ? `${d}/${m} ${time}` : `${d}/${m}`;
}
