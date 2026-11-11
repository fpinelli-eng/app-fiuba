// Types and formatting of the Finales section. No database access: client components import from here.

import { shortTeacherList, surname } from "../plan/format";
import type { ExamReminderView } from "../reminders/model";

export interface ExamTableView {
  id: number;
  /** SIU subject code of this table (a subject may have several). */
  code: string;
  /** "MESA 01", "Mesa 1 Surace" */
  name: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "Regular", "Libre"… */
  kind: string;
  /** "YYYY-MM-DDTHH:MM", Buenos Aires time. */
  enrollFrom: string | null;
  enrollTo: string | null;
  /** "HH:MM", when the dates were loaded with the SIU link. */
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  /** Last moment to drop out, "YYYY-MM-DDTHH:MM". */
  dropUntil: string | null;
  /** As the SIU lists them: "SURACE PABLO ESTEBAN (Profesor/a), …" */
  teachers: string | null;
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
  planId: string;
  /** "Recordarme": the student's reminders, or null while the database does not have them yet. */
  reminders: ExamReminderView[] | null;
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

/** "17:00", "17:00 a 20:00", or null without a start time. */
export function formatExamTime(start: string | null, end: string | null): string | null {
  if (!start) return null;
  return end && end !== start ? `${start} a ${end}` : start;
}

/**
 * Surnames of the examiners, as in the rest of the app: "SURACE PABLO ESTEBAN (Profesor/a),
 * VARGAS GABRIELA (Secretario/a Departamento)" → "Surace". The department's secretary and
 * director sign every "libre" exam, so they are left out when there are professors.
 */
export function formatTeachers(teachers: string | null): string | null {
  if (!teachers) return null;
  const people = teachers.split(",").flatMap((part) => {
    const i = part.indexOf("(");
    const name = (i >= 0 ? part.slice(0, i) : part).trim();
    return name ? [{ name, role: i >= 0 ? part.slice(i) : "" }] : [];
  });
  const examiners = people.filter((p) => !/departamento/i.test(p.role));
  const shown = (examiners.length ? examiners : people).map((p) => surname(p.name, []));
  return shown.length ? shortTeacherList(shown) : null;
}

/** "2026-12-07T14:00" → "7/12 14:00" (no time when it is 00:00 or 23:59). */
export function formatEnrollMoment(moment: string): string {
  const [date, time] = moment.split("T");
  const [, m, d] = date.split("-").map(Number);
  return time && time !== "00:00" && time !== "23:59" ? `${d}/${m} ${time}` : `${d}/${m}`;
}
