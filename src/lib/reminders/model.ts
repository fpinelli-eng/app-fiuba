// "Recordarme" in Finales: types and the natural key of a reminder, shared by the app. Which mail is
// due, and when, is decided in the database (avisos_pendientes(), migration
// 20261114120000_avisos_rpc.sql) for the Apps Script that sends them (tools/reminders/).

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
