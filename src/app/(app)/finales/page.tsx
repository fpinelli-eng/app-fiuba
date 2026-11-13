import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getFinalsData } from "@/lib/exams/data";
import { getReminderMailState } from "@/lib/reminders/data";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { FinalsView } from "./FinalsView";

export const metadata: Metadata = { title: `Finales · ${APP_NAME}` };

// Finales: the student's pending finals first, then every exam table of the plan with a search box.
export default async function FinalesPage() {
  const account = await requireProfile();
  const [data, reminderMail] = await Promise.all([
    getFinalsData(account.id, account.planId!),
    createClient().then((supabase) => getReminderMailState(supabase, account.id, account.email)),
  ]);
  return <FinalsView data={data} reminderMail={reminderMail} />;
}
