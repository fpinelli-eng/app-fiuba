/** Pending reminders of the student: exam reminders by subject name, calendar ones by event id. */
export interface MyReminders {
  exams: Record<string, number>;
  events: Record<string, number>;
}
