// "Recordarme": where the reminder mails go and when the confirmation mail is due. Pure, so it runs in
// the browser and the server and is tested. The database applies the same rules
// (set_my_reminder_email() and avisos_confirmaciones(), migration 20261116120000_recordarme_confirmacion.sql);
// these are for the screen: what to show and whether to promise a confirmation mail.

/** The account that sends the reminders. */
export const REMINDER_SENDER = "avisosfiubi@gmail.com";

export const REMINDER_EMAIL_MAX = 254;
/** A plain address, the same as the database check: no spaces, commas or brackets, one @. */
const EMAIL_RE = /^(?=[^@]{1,64}@)[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/** Confirmations per student in 24 hours (the address can be anyone's). */
export const CONFIRMATIONS_PER_DAY = 3;

export interface ReminderMailState {
  /** The student's account, @fi.uba.ar. */
  account: string;
  /** The other mail they prefer for the reminders, or null. */
  custom: string | null;
  /** Confirmation mails sent, newest first. */
  confirmations: { email: string; sentAt: string }[];
}

/**
 * What the student typed as their other mail: null clears it (empty, or their own account), an
 * error when it is not a plain address.
 */
export function normalizeReminderEmail(input: string | null | undefined, account: string): { email: string | null } | { error: string } {
  const email = (input ?? "").trim().toLowerCase();
  if (!email) return { email: null };
  if (email.length > REMINDER_EMAIL_MAX || !EMAIL_RE.test(email)) return { error: "Revisá el mail: tiene que ser como nombre@gmail.com." };
  return { email: email === account.trim().toLowerCase() ? null : email };
}

/** Where the reminder mails go now. */
export function reminderDestination(s: ReminderMailState): string {
  return s.custom ?? s.account.trim().toLowerCase();
}

/**
 * Whether a confirmation mail is due: the student has reminders (of their plan) and their last
 * confirmation went to another address (or none went), within CONFIRMATIONS_PER_DAY.
 */
export function confirmationDue(s: ReminderMailState, activeReminders: number, now: number = Date.now()): boolean {
  if (activeReminders <= 0) return false;
  const sorted = [...s.confirmations].sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
  if (sorted[0]?.email.toLowerCase() === reminderDestination(s)) return false;
  const recent = sorted.filter((c) => Date.parse(c.sentAt) > now - 24 * 60 * 60 * 1000).length;
  return recent < CONFIRMATIONS_PER_DAY;
}

/**
 * What the screen says after saving: a confirmation goes to `to` "en unos minutos" (with the instant
 * path; without it, within the hour: the copy stays simple on purpose).
 */
export interface ConfirmationNotice {
  to: string;
}
