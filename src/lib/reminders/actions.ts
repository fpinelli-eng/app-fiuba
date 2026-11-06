"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

// "Recordarme": the database (RLS) only lets each student create and delete their own reminders.

export type ReminderResult = { id: number | null; error: string | null };

const FAILED = "No pudimos guardar el recordatorio. Probá de nuevo.";

export async function remindExam(subject: string, siuCodes: string[]): Promise<ReminderResult> {
  await requireProfile();
  const codes = [...new Set(siuCodes.filter((c) => typeof c === "string" && /^[A-Z0-9]{2,12}$/.test(c)))].slice(0, 10);
  if (!subject || subject.length > 200 || codes.length === 0) return { id: null, error: FAILED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("reminders").insert({ kind: "exam", subject_name: subject, siu_codes: codes }).select("id").single();
  if (error) return { id: null, error: FAILED };
  revalidatePath("/finales");
  return { id: data.id as number, error: null };
}

export async function remindEvent(eventId: number): Promise<ReminderResult> {
  await requireProfile();
  if (!Number.isInteger(eventId) || eventId <= 0) return { id: null, error: FAILED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("reminders").insert({ kind: "calendar", academic_event_id: eventId }).select("id").single();
  if (error) return { id: null, error: FAILED };
  revalidatePath("/novedades");
  return { id: data.id as number, error: null };
}

export async function cancelReminder(id: number): Promise<ReminderResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) return { id, error: "No pudimos cancelar el recordatorio. Probá de nuevo." };
  revalidatePath("/finales");
  revalidatePath("/novedades");
  return { id: null, error: null };
}
