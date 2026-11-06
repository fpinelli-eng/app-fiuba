"use client";

import { useState, useTransition } from "react";
import { cancelReminder, remindEvent, remindExam, type ReminderResult } from "@/lib/reminders/actions";

// "Recordarme": one email when the enrollment of a final opens, or the morning a calendar date
// starts. Toggles; the result is announced to screen readers.
type Target = { kind: "exam"; subject: string; siuCodes: string[] } | { kind: "calendar"; eventId: number };

export function ReminderButton({ target, reminderId, label }: { target: Target; reminderId: number | null; label: string }) {
  const [id, setId] = useState(reminderId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const on = id !== null;

  const toggle = () =>
    startTransition(async () => {
      let r: ReminderResult;
      if (on) r = await cancelReminder(id);
      else r = target.kind === "exam" ? await remindExam(target.subject, target.siuCodes) : await remindEvent(target.eventId);
      setError(r.error ?? "");
      if (r.error) return setMessage(r.error);
      setId(r.id);
      setMessage(r.id === null ? "Recordatorio cancelado." : "Listo: te avisamos por mail.");
    });

  return (
    <span className="flex flex-none flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        aria-label={`${on ? "Recordatorio activado" : "Recordarme"}: ${label}`}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold disabled:opacity-60 md:min-h-8 ${
          on ? "bg-accent-soft text-accent" : "border border-line-strong bg-surface text-ink-2 hover:text-ink"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {on ? "Te avisamos" : "Recordarme"}
      </button>
      <span role="status" aria-live="polite" className={error ? "text-[12px] text-danger" : "sr-only"}>
        {message}
      </span>
    </span>
  );
}
