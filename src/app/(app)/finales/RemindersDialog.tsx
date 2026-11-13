"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { normalizeText } from "@/lib/map/model";
import { enrollmentStatus, formatExamDay, formatExamTime, type ExamSubjectView, type ExamTableView, type FinalsData } from "@/lib/exams/types";
import { normalizeReminderEmail, reminderDestination, type ConfirmationNotice, type ReminderMailState } from "@/lib/reminders/mail";
import { reminderKey, type ExamReminderView } from "@/lib/reminders/model";
import { saveExamReminders, saveReminderEmail, type ReminderPick, type SaveRemindersResult } from "./actions";
import { ReminderEmailField, type EmailStatus } from "./ReminderMail";

// "Recordarme": the student checks the exam tables they want a mail for, sent when the enrollment
// opens (only one: Francisco, 12 Nov 2026). Only tables that have not opened yet are offered, plus
// the ones already saved whose enrollment is open now. Pending finals first; other subjects through
// the search box. Reminders whose table closed or is no longer in the SIU are listed apart, so they
// can be removed too.
// Native <dialog> like ConfirmCourses: a bottom sheet on the phone, centered from md.
// Visual design pending (Francisco): only existing classes and tokens.
// At the top, where the mails go and the optional other mail (ReminderMail.tsx). "Aceptar" also
// saves a mail typed and not saved yet.

/** What Finales shows after saving: a line and, when one is due, the confirmation mail help. */
export interface SavedNotice {
  text: string;
  confirmation: ConfirmationNotice | null;
}

interface Candidate {
  key: string;
  pick: ReminderPick;
  table: ExamTableView;
  /** Saved earlier and the enrollment is open now: its mail already went (or was not due). */
  open: boolean;
}

function candidates(subject: ExamSubjectView, planId: string, now: string, saved: Set<string>): Candidate[] {
  return subject.tables
    .map((t) => {
      const pick = { code: t.code, name: t.name, kind: t.kind, date: t.date, subjectName: subject.name };
      return { key: reminderKey({ planId, ...pick }), pick, table: t, open: enrollmentStatus(t, now).kind === "open" };
    })
    .filter((c) => enrollmentStatus(c.table, now).kind === "soon" || (c.open && saved.has(c.key)));
}


export function RemindersDialog({
  data,
  reminders,
  mail,
  onMailChange,
  onSaved,
  onClose,
}: {
  data: FinalsData;
  reminders: ExamReminderView[];
  /** null: the database does not have the other mail yet (previews): the field is not shown. */
  mail: ReminderMailState | null;
  onMailChange: (mail: ReminderMailState) => void;
  /** notice null: nothing to say (an error is shown in the dialog). */
  onSaved: (reminders: ExamReminderView[], notice: SavedNotice | null) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { now, planId } = data;
  const mine = reminders.filter((r) => r.planId === planId);
  const initial = new Set(mine.map(reminderKey));
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" } | { kind: "error"; message: string }>({ kind: "idle" });
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ kind: "idle" });

  // Saves the other mail (null: back to the account). Returns false on error, else the confirmation due.
  const saveEmail = async (value: string | null): Promise<false | { to: string; confirmation: ConfirmationNotice | null }> => {
    setEmailStatus({ kind: "saving" });
    const result = await saveReminderEmail(value).catch(() => ({ error: "No pudimos guardar el mail.", mail: null, confirmation: null }));
    if (result.error) {
      setEmailStatus({ kind: "error", message: result.error });
      return false;
    }
    if (result.mail) onMailChange(result.mail);
    setEmailDraft(null);
    setEmailStatus({ kind: "saved", confirmation: result.confirmation });
    return { to: result.mail ? reminderDestination(result.mail) : (mail?.account ?? ""), confirmation: result.confirmation };
  };

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const pendingKeys = new Set(data.pending.map((s) => s.key));
  const pending = data.pending.map((s) => ({ subject: s, items: candidates(s, planId, now, initial) })).filter((g) => g.items.length > 0);
  const q = normalizeText(query);
  const others = data.all
    .filter((s) => !pendingKeys.has(s.key))
    .map((s) => ({ subject: s, items: candidates(s, planId, now, initial) }))
    .filter((g) => g.items.length > 0 && ((q && normalizeText(g.subject.name).includes(q)) || g.items.some((c) => initial.has(c.key) || selected.has(c.key))));
  const offered = new Set([...data.pending, ...data.all].flatMap((s) => candidates(s, planId, now, initial).map((c) => c.key)));
  const listed = new Set([...data.pending, ...data.all].flatMap((s) => s.tables.map((t) => reminderKey({ planId, ...t }))));
  // Saved reminders whose table is closed or no longer in the SIU.
  const leftover = mine.filter((r) => !offered.has(reminderKey(r)));

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const save = async () => {
    // A mail typed and not saved: saved first (if it is wrong, the dialog stays open with the error).
    let emailSaved: { to: string; confirmation: ConfirmationNotice | null } | null = null;
    if (mail && emailDraft !== null) {
      const typed = normalizeReminderEmail(emailDraft, mail.account);
      if (!("email" in typed) || typed.email !== mail.custom) {
        setState({ kind: "saving" });
        const saved = await saveEmail(emailDraft);
        if (!saved) {
          setState({ kind: "idle" });
          return;
        }
        emailSaved = { to: saved.to, confirmation: saved.confirmation };
      } else setEmailDraft(null);
    }
    const emailConfirmation = emailSaved?.confirmation ?? null;
    const changed = selected.size !== initial.size || [...selected].some((k) => !initial.has(k));
    if (!changed) {
      if (emailSaved) onSaved(reminders, { text: `Listo, te avisamos a ${emailSaved.to}.`, confirmation: emailConfirmation });
      dialog.current?.close();
      return;
    }
    const picks = new Map<string, ReminderPick>();
    for (const s of [...data.pending, ...data.all]) for (const c of candidates(s, planId, now, initial)) if (selected.has(c.key)) picks.set(c.key, c.pick);
    for (const r of leftover) {
      const key = reminderKey(r);
      if (selected.has(key)) picks.set(key, { code: r.code, name: r.name, kind: r.kind, date: r.date, subjectName: r.subjectName });
    }
    setState({ kind: "saving" });
    const result = await saveExamReminders([...picks.values()]).catch((): SaveRemindersResult => ({ error: "No pudimos guardar tus recordatorios.", reminders: null }));
    if (result.error) {
      if (result.reminders) {
        onSaved(result.reminders, null);
        setSelected(new Set(result.reminders.filter((r) => r.planId === planId).map(reminderKey)));
      }
      setState({ kind: "error", message: result.error });
      return;
    }
    const saved = result.reminders ?? [];
    const active = saved.filter((r) => r.planId === planId).length;
    const confirmation = result.confirmation ?? emailConfirmation;
    onSaved(saved, {
      text: active > 0 ? "Te vamos a mandar un mail cuando abra la inscripción, así no te olvidás." : "Listo, sacamos tus recordatorios.",
      confirmation: active > 0 ? confirmation : null,
    });
    dialog.current?.close();
  };

  // Checkbox ids by render order (keys have characters an id cannot).
  const ids = new Map<string, string>();
  const idFor = (key: string) => {
    if (!ids.has(key)) ids.set(key, `recordarme-${ids.size}`);
    return ids.get(key)!;
  };

  const row = (key: string, title: ReactNode, detail?: string) => {
    const id = idFor(key);
    return (
      <li key={key}>
        <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-bg">
          <input id={id} type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="mt-0.5 size-5 flex-none accent-[var(--accent)]" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm text-ink tabular-nums">{title}</span>
            {detail && <span className="text-[12.5px] text-muted tabular-nums">{detail}</span>}
          </span>
        </label>
      </li>
    );
  };

  // One line per table: day and table (the course, usually with the professor's surname) in ink, the
  // time and the kind in gray. No bold and no enrollment window (Francisco, 11 Nov 2026: option C).
  const tableTitle = (t: Pick<ExamTableView, "date" | "startTime" | "endTime" | "name" | "kind">) => {
    const extra = [formatExamTime(t.startTime, t.endTime), t.kind !== "Regular" ? t.kind : null].filter(Boolean).join(" · ");
    return (
      <>
        {formatExamDay(t.date)} · {t.name}
        {extra && (
          <>
            {" "}
            <span className="ml-1.5 whitespace-nowrap text-muted">{extra}</span>
          </>
        )}
      </>
    );
  };

  const group = (subject: ExamSubjectView, items: Candidate[]) => (
    <fieldset key={subject.key} className="flex flex-col">
      <legend className="px-2 pb-1 text-[15px] font-semibold">{subject.name}</legend>
      <ul className="flex flex-col">{items.map((c) => row(c.key, tableTitle(c.table), c.open ? "Inscripción abierta" : undefined))}</ul>
    </fieldset>
  );

  const count = selected.size;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="recordarme-titulo"
      aria-describedby="recordarme-desc"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="inset-x-0 mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-full flex-col rounded-t-[20px] border-0 bg-surface p-0 text-ink transition-transform duration-200 backdrop:bg-pop-shadow open:flex starting:open:translate-y-full md:mx-auto md:my-auto md:max-h-[80dvh] md:w-[600px] md:rounded-[20px] md:starting:open:translate-y-4"
    >
      <div className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-line-strong md:hidden" aria-hidden="true" />
      <div className="flex flex-none items-start gap-3 border-b border-line px-4 pt-2 pb-3 md:px-6 md:pt-5 md:pb-4">
        <div className="min-w-0 flex-auto">
          <h2 id="recordarme-titulo" className="text-[19px] leading-tight font-semibold">
            Recordarme
          </h2>
          <p id="recordarme-desc" className="mt-0.5 text-[13.5px] text-muted">
            Elegí las mesas y te avisamos por mail cuando abra la inscripción.
          </p>
        </div>
        <button
          onClick={() => dialog.current?.close()}
          aria-label="Cerrar"
          className="-mt-1 -mr-2 grid size-10 flex-none place-items-center rounded-full text-muted hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-2 py-3 md:px-4 md:py-4">
        {mail && (
          <ReminderEmailField
            mail={mail}
            draft={emailDraft}
            status={emailStatus}
            onDraft={(draft) => {
              setEmailDraft(draft);
              if (emailStatus.kind === "error" || draft !== null) setEmailStatus({ kind: "idle" });
            }}
            onSave={(email) => void saveEmail(email)}
          />
        )}
        {pending.length > 0 ? (
          <section aria-labelledby="recordarme-pendientes" className="flex flex-col gap-3">
            <h3 id="recordarme-pendientes" className="px-2 text-[13px] font-semibold text-muted">
              Tus finales pendientes
            </h3>
            {pending.map((g) => group(g.subject, g.items))}
          </section>
        ) : (
          <p className="mx-2 rounded-xl bg-bg px-4 py-5 text-center text-[14px] text-muted">Tus finales pendientes no tienen mesas con la inscripción por abrir.</p>
        )}

        <section aria-labelledby="recordarme-otras" className="flex flex-col gap-3">
          <h3 id="recordarme-otras" className="px-2 text-[13px] font-semibold text-muted">
            Otras materias
          </h3>
          <div className="px-2">
            <label htmlFor="recordarme-q" className="sr-only">
              Buscar otra materia
            </label>
            <input
              id="recordarme-q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá otra materia"
              className="h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent md:h-10 md:text-sm"
            />
          </div>
          {q && others.length === 0 && <p className="px-2 text-[13px] text-muted">No encontramos mesas con la inscripción por abrir.</p>}
          {others.map((g) => group(g.subject, g.items))}
        </section>

        {leftover.length > 0 && (
          <section aria-labelledby="recordarme-otros" className="flex flex-col gap-1">
            <h3 id="recordarme-otros" className="px-2 text-[13px] font-semibold text-muted">
              Ya no se puede anotar o no está en el SIU
            </h3>
            <ul className="flex flex-col">
              {leftover.map((r) =>
                row(reminderKey(r), <>{r.subjectName} · {tableTitle({ ...r, endTime: null })}</>, listed.has(reminderKey(r)) ? "Inscripción cerrada" : "Ya no está en el SIU"),
              )}
            </ul>
          </section>
        )}
      </div>

      <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-6 md:pb-4">
        <div className="mr-auto text-[13px] text-muted" aria-live="polite">
          {state.kind === "error" ? (
            <span className="text-danger">{state.message}</span>
          ) : count > 0 ? (
            <>
              <b className="text-ink">{count}</b> {count === 1 ? "mesa elegida" : "mesas elegidas"}
            </>
          ) : null}
        </div>
        <button
          onClick={() => dialog.current?.close()}
          className="h-11 rounded-[10px] border border-line bg-surface px-4 text-[14px] text-muted hover:text-ink md:h-10"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={state.kind === "saving"}
          className="h-11 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink md:h-10"
        >
          {state.kind === "saving" ? "Guardando…" : "Aceptar"}
        </button>
      </div>
    </dialog>
  );
}
