"use client";

import { REMINDER_SENDER, reminderDestination, type ConfirmationNotice, type ReminderMailState } from "@/lib/reminders/mail";

// "Recordarme": where the mails go (and the optional other mail), and what to do so the confirmation
// mail does not stay in Spam. Small pieces, so the design can change without touching the logic.
// Visual design pending (Francisco): only existing classes and tokens.

/** "En unos minutos te llega un mail de confirmación…": the help after saving. Inline content. */
export function ConfirmationText({ confirmation }: { confirmation: ConfirmationNotice }) {
  return (
    <>
      {confirmation.soon ? "En unos minutos" : "En la próxima hora"} te llega un mail de confirmación de <b className="font-semibold">{REMINDER_SENDER}</b> a{" "}
      <b className="font-semibold break-all">{confirmation.to}</b>. Si no está en Recibidos, buscalo en Spam y tocá «No es spam», o agregá {REMINDER_SENDER} a tus
      contactos.
    </>
  );
}

export type EmailStatus = { kind: "idle" | "saving" } | { kind: "error"; message: string } | { kind: "saved"; confirmation: ConfirmationNotice | null };

/**
 * "Te avisamos a ana@fi.uba.ar · ¿Preferís otro mail?". draft null: closed; a string: the field is
 * open with that text (the dialog keeps it, so "Aceptar" saves it too).
 */
export function ReminderEmailField({
  mail,
  draft,
  status,
  onDraft,
  onSave,
}: {
  mail: ReminderMailState;
  draft: string | null;
  status: EmailStatus;
  onDraft: (draft: string | null) => void;
  onSave: (email: string | null) => void;
}) {
  const saving = status.kind === "saving";
  const error = status.kind === "error" ? status.message : null;
  return (
    <section aria-labelledby="recordarme-mail" className="mx-2 rounded-xl bg-bg px-3 py-2">
      <h3 id="recordarme-mail" className="sr-only">
        Mail de los avisos
      </h3>
      {draft === null ? (
        <div className="flex flex-wrap items-center gap-x-2 text-[13.5px]">
          <span className="min-w-0 py-2 text-muted">
            Te avisamos a <b className="font-semibold break-all text-ink">{reminderDestination(mail)}</b>
          </span>
          <button type="button" onClick={() => onDraft(mail.custom ?? "")} className="min-h-10 font-semibold text-accent hover:underline">
            {mail.custom ? "Cambiar" : "¿Preferís otro mail?"}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
          }}
          className="flex flex-col gap-2 py-1"
        >
          <label htmlFor="recordarme-mail-input" className="text-[13.5px] font-semibold text-ink">
            ¿Preferís recibir los avisos en otro mail?
          </label>
          <input
            id="recordarme-mail-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            maxLength={254}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder="nombre@gmail.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "recordarme-mail-error" : undefined}
            className="h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent md:h-10 md:text-sm"
          />
          {error && (
            <p id="recordarme-mail-error" className="text-[12.5px] text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-[10px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {mail.custom && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSave(null)}
                className="h-10 rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] text-muted hover:text-ink"
              >
                Usar mi mail de la facultad
              </button>
            )}
            <button type="button" onClick={() => onDraft(null)} className="h-10 rounded-[10px] px-2 text-[13.5px] text-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      )}
      {/* Always rendered (empty: no height), so screen readers announce what changes. */}
      <p role="status" className="pb-1 text-[12.5px] text-muted empty:pb-0">
        {status.kind === "saved" && (status.confirmation ? <ConfirmationText confirmation={status.confirmation} /> : "Listo, guardamos el mail.")}
      </p>
    </section>
  );
}
