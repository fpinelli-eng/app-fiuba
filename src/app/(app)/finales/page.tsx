import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getFinalsData } from "@/lib/exams/data";
import { getMyReminders } from "@/lib/reminders/data";
import { requireProfile } from "@/lib/session";
import { FinalsView } from "./FinalsView";

export const metadata: Metadata = { title: `Finales · ${APP_NAME}` };

// Finales: the student's pending finals first, then every exam table of the plan with a search box.
export default async function FinalesPage() {
  const account = await requireProfile();
  const [data, reminders] = await Promise.all([getFinalsData(account.id, account.planId!), getMyReminders()]);
  return <FinalsView data={data} reminders={reminders} />;
}
