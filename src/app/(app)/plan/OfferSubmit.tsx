"use client";

import { useActionState, useState } from "react";
import { MAX_OFFER_CHARS, submissionStatusText, type MySubmission } from "@/lib/offer/submission";
import { submitOffer, type SubmitOfferState } from "./actions";

// Plan sin oferta del cuatrimestre: el alumno copia la oferta de comisiones del SIU y la pega.
// Queda pendiente hasta que un administrador la publica para todo el plan.
// Marcado mínimo con las clases que ya existen: el diseño lo define el rediseño visual.

const initial: SubmitOfferState = { error: null, message: null };

export function OfferSubmit({ term, submission }: { term: string; submission: MySubmission | null }) {
  const [state, action, pending] = useActionState(submitOffer, initial);
  const [text, setText] = useState("");
  const status = submissionStatusText(submission);

  if (state.message) {
    return (
      <p role="status" className="rounded-[10px] bg-mint px-3 py-2 text-sm text-mint-ink">
        {state.message}
      </p>
    );
  }
  if (submission?.status === "pending") {
    return (
      <p role="status" className="text-sm text-ink-2">
        {status}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-ink">¿Nos ayudás a cargarla?</h2>
        <p className="text-sm text-muted">Con la oferta del SIU, todos los de tu plan van a poder armar su {term}.</p>
      </div>
      {status && <p className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">{status}</p>}
      <ol className="list-decimal pl-5 text-sm text-ink-2">
        <li>Entrá al SIU Guaraní con tu usuario y abrí la oferta de comisiones de tu carrera.</li>
        <li>Seleccioná toda la página y copiala (Ctrl+A y Ctrl+C). Es más fácil desde la compu.</li>
        <li>Pegala acá abajo y tocá Enviar.</li>
      </ol>
      <label htmlFor="offer-text" className="sr-only">
        Texto copiado del SIU
      </label>
      <textarea
        id="offer-text"
        name="text"
        rows={8}
        maxLength={MAX_OFFER_CHARS}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pegá acá la página del SIU"
        // 16 px en el celular: con menos, el iPhone hace zoom al tocar el campo.
        className="w-full resize-y rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-base leading-snug text-ink md:text-sm"
      />
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="h-11 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink md:h-10"
        >
          {pending ? "Revisando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
