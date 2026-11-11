import type { createClient } from "@/lib/supabase/server";
import { toMoment } from "@/lib/exams/group";
import type { ExamReminderView } from "./model";

type Client = Awaited<ReturnType<typeof createClient>>;

// The table does not exist yet: Vercel previews use the production database, which gets the
// migration only when the pull request is merged. Then "Recordarme" is not shown.
const NOT_YET = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

export const REMINDER_COLUMNS = "id, plan_id, siu_subject_code, table_name, kind, exam_date, subject_name, start_time, enroll_from, enroll_to";

export interface ReminderRow {
  id: number;
  plan_id: string;
  siu_subject_code: string;
  table_name: string;
  kind: string;
  exam_date: string;
  subject_name: string;
  start_time: string | null;
  enroll_from: string | null;
  enroll_to: string | null;
}

export function toReminderView(r: ReminderRow): ExamReminderView {
  return {
    id: r.id,
    planId: r.plan_id,
    code: r.siu_subject_code,
    name: r.table_name,
    kind: r.kind,
    date: r.exam_date,
    subjectName: r.subject_name,
    startTime: r.start_time ? r.start_time.slice(0, 5) : null,
    enrollFrom: toMoment(r.enroll_from),
    enrollTo: toMoment(r.enroll_to),
  };
}

/** The student's exam reminders (RLS: only their own), or null when the table is not there yet. */
export async function getMyReminders(supabase: Client): Promise<ExamReminderView[] | null> {
  const { data, error } = await supabase.from("exam_reminders").select(REMINDER_COLUMNS).order("exam_date").order("id");
  if (error) {
    if (NOT_YET.has(error.code)) return null;
    throw new Error(`exam_reminders: ${error.message}`);
  }
  return (data as ReminderRow[]).map(toReminderView);
}
