"use server";

import { revalidatePath } from "next/cache";
import { getMyReminders, getReminderMailState } from "@/lib/reminders/data";
import { requestConfirmations } from "@/lib/reminders/instant";
import { confirmationDue, normalizeReminderEmail, reminderDestination, type ConfirmationNotice, type ReminderMailState } from "@/lib/reminders/mail";
import { reminderKey, type ExamReminderView, type ReminderKey } from "@/lib/reminders/model";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, type Account } from "@/lib/session";

/** An exam table picked in "Recordarme": its natural key and the subject name the app shows. */
export interface ReminderPick {
  code: string;
  name: string;
  kind: string;
  date: string;
  subjectName: string;
}

export type SaveRemindersResult = {
  error: string | null;
  reminders: ExamReminderView[] | null;
  /** A confirmation mail is due (first reminders, or a new address): where it goes. */
  confirmation?: ConfirmationNotice | null;
};

export type SaveReminderEmailResult = { error: string | null; mail: ReminderMailState | null; confirmation: ConfirmationNotice | null };

const MAX = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

// "Recordarme": the student's reminders become exactly the picked tables (the unchecked ones are
// deleted, the new ones created). The snapshot (time, enrollment window) is read from exam_tables,
// not taken from the browser; the database checks again that each table is of the student's plan.
export async function saveExamReminders(picks: ReminderPick[]): Promise<SaveRemindersResult> {
  const account = await requireProfile();
  const planId = account.planId!;
  if (!Array.isArray(picks) || picks.length > MAX) return { error: `Podés tener hasta ${MAX} recordatorios.`, reminders: null };
  const valid = picks.every(
    (p) => p && text(p.code, 20) && text(p.name, 120) && text(p.kind, 60) && typeof p.date === "string" && DATE.test(p.date) && text(p.subjectName, 200),
  );
  if (!valid) return { error: "Mesas inválidas.", reminders: null };

  const keyOf = (p: Omit<ReminderKey, "planId">) => reminderKey({ planId, code: p.code, name: p.name, kind: p.kind, date: p.date });
  const wanted = new Map(picks.map((p) => [keyOf(p), p]));

  const supabase = await createClient();
  const current = await getMyReminders(supabase);
  if (current === null) return { error: "Los recordatorios todavía no están disponibles.", reminders: null };
  const have = new Set(current.map(reminderKey));
  // After an error, what is saved now (a part may have changed).
  const fail = async (error: string): Promise<SaveRemindersResult> => ({ error, reminders: await getMyReminders(supabase).catch(() => null) });

  const removed = current.filter((r) => !wanted.has(reminderKey(r))).map((r) => r.id);
  const added = [...wanted.entries()].filter(([key]) => !have.has(key)).map(([, p]) => p);

  if (removed.length) {
    const { error } = await supabase.from("exam_reminders").delete().in("id", removed);
    if (error) return fail("No pudimos guardar tus recordatorios.");
  }

  if (added.length) {
    const tables = await supabase
      .from("exam_tables")
      .select("siu_subject_code, name, kind, exam_date, start_time, enroll_from, enroll_to")
      .eq("plan_id", planId)
      .in("siu_subject_code", [...new Set(added.map((p) => p.code))])
      .in("exam_date", [...new Set(added.map((p) => p.date))]);
    if (tables.error) return fail("No pudimos guardar tus recordatorios.");
    const byKey = new Map(tables.data.map((t) => [keyOf({ code: t.siu_subject_code, name: t.name, kind: t.kind, date: t.exam_date }), t]));
    const rows = added.flatMap((p) => {
      const t = byKey.get(keyOf(p));
      return t
        ? [
            {
              plan_id: planId,
              siu_subject_code: p.code,
              table_name: p.name,
              kind: p.kind,
              exam_date: p.date,
              subject_name: p.subjectName.trim(),
              start_time: t.start_time,
              enroll_from: t.enroll_from,
              enroll_to: t.enroll_to,
            },
          ]
        : [];
    });
    if (rows.length < added.length) return fail("Alguna mesa ya no está en el SIU. Recargá la página.");
    const { error } = await supabase.from("exam_reminders").insert(rows);
    if (error) return fail("No pudimos guardar tus recordatorios.");
  }

  revalidatePath("/finales");
  const reminders = await getMyReminders(supabase);
  const confirmation = await confirmAfterSave(supabase, account, reminders);
  return { error: null, reminders, confirmation };
}

/**
 * After a save: if a confirmation mail is due, asks the script to send it now (when the instant path
 * is set up) and says where it goes. Never fails the save: without the migration, nothing.
 */
async function confirmAfterSave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  account: Account,
  reminders: ExamReminderView[] | null,
  mail?: ReminderMailState | null,
): Promise<ConfirmationNotice | null> {
  try {
    const state = mail === undefined ? await getReminderMailState(supabase, account.id, account.email) : mail;
    const active = (reminders ?? []).filter((r) => r.planId === account.planId).length;
    if (!state || !confirmationDue(state, active)) return null;
    requestConfirmations();
    return { to: reminderDestination(state) };
  } catch {
    return null;
  }
}

// "¿Preferís recibir los avisos en otro mail?": any domain; empty clears it. Only through
// set_my_reminder_email(), which checks it again.
export async function saveReminderEmail(input: string | null): Promise<SaveReminderEmailResult> {
  const account = await requireProfile();
  const normalized = normalizeReminderEmail(typeof input === "string" ? input.slice(0, 400) : null, account.email);
  if ("error" in normalized) return { error: normalized.error, mail: null, confirmation: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_reminder_email", { p_email: normalized.email });
  if (error) {
    if (error.code === "22023") return { error: "Revisá el mail: tiene que ser como nombre@gmail.com.", mail: null, confirmation: null };
    return { error: "No pudimos guardar el mail.", mail: null, confirmation: null };
  }
  const mail = await getReminderMailState(supabase, account.id, account.email);
  const reminders = await getMyReminders(supabase).catch(() => null);
  revalidatePath("/finales");
  return { error: null, mail, confirmation: await confirmAfterSave(supabase, account, reminders, mail) };
}
