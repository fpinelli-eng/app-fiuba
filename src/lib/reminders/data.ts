import { createClient } from "@/lib/supabase/server";
import type { MyReminders } from "./types";

// The student's pending reminders (RLS: only their own). Server only.
export async function getMyReminders(): Promise<MyReminders> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reminders").select("id, kind, subject_name, academic_event_id").is("sent_at", null);
  if (error?.code === "42P01" || error?.code === "PGRST205") return { exams: {}, events: {} }; // before the migration
  if (error) throw new Error(`reminders: ${error.message}`);
  const out: MyReminders = { exams: {}, events: {} };
  for (const r of data) {
    if (r.kind === "exam" && r.subject_name) out.exams[r.subject_name as string] = r.id as number;
    if (r.kind === "calendar" && r.academic_event_id) out.events[String(r.academic_event_id)] = r.id as number;
  }
  return out;
}
