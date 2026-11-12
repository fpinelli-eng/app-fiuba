// What the workflow "Recordatorios" sends in one run, from what tools/reminders/due.sql printed.
// Pure, so it is unit tested; tools/reminders/send.mjs does the SMTP part. Runs in Node with type
// stripping (type annotations only, relative imports).

import { buildReminderMail, type ReminderMail } from "./email";
import { currentTablesByKey, dueMail, reminderKey, type CurrentTable, type ReminderMailKind } from "./model";

/** One pending reminder, as due.sql prints it (snake_case, Buenos Aires moments). */
export interface DumpReminder {
  id: number;
  email: string;
  plan_id: string;
  code: string;
  name: string;
  kind: string;
  date: string;
  subject_name: string;
  created_at: string;
  first_sent: boolean;
}

export interface DumpTable {
  plan_id: string;
  code: string;
  name: string;
  kind: string;
  date: string;
  enroll_from: string | null;
  enroll_to: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface Dump {
  reminders: DumpReminder[];
  tables: DumpTable[];
}

export interface PlannedMail extends ReminderMail {
  id: number;
  which: ReminderMailKind;
  to: string;
}

export interface RunPlan {
  mails: PlannedMail[];
  /** Counts only: the log of a public repository. */
  counts: { pending: number; first: number; missing: number };
}

const toTable = (t: DumpTable): CurrentTable => ({
  planId: t.plan_id,
  code: t.code,
  name: t.name,
  kind: t.kind,
  date: t.date,
  enrollFrom: t.enroll_from,
  enrollTo: t.enroll_to,
  startTime: t.start_time,
  endTime: t.end_time,
});

/** Only institutional addresses get mails (the login only lets them in anyway). */
const FIUBA_MAIL = /^[^\s@<>",]+@fi\.uba\.ar$/i;

export function planRun(dump: Dump, now: string): RunPlan {
  const current = currentTablesByKey(dump.tables.map(toTable));
  const counts = { pending: dump.reminders.length, first: 0, missing: 0 };
  const mails: PlannedMail[] = [];
  for (const r of dump.reminders) {
    const table = current.get(reminderKey({ planId: r.plan_id, code: r.code, name: r.name, kind: r.kind, date: r.date })) ?? null;
    if (!table) {
      counts.missing++;
      continue;
    }
    const which = dueMail({ createdAt: r.created_at, firstSent: r.first_sent }, table, now);
    if (!which || !table.enrollTo || !FIUBA_MAIL.test(r.email)) continue;
    counts[which]++;
    const mail = buildReminderMail({
      which,
      subjectName: r.subject_name,
      table: { name: table.name, kind: table.kind, date: table.date, startTime: table.startTime, endTime: table.endTime, enrollTo: table.enrollTo },
    });
    mails.push({ id: r.id, which, to: r.email, ...mail });
  }
  return { mails, counts };
}
