"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteState } from "./actions";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState>(deleteAccount, { error: null });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-[10px] border border-danger-line bg-surface px-4 text-sm font-semibold whitespace-nowrap text-danger"
      >
        Borrar mi cuenta
      </button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl bg-danger-soft p-4">
      <div className="max-w-[460px] text-sm text-danger-ink">
        Se borran tu cuenta, tus materias y tus planes. Tus reseñas siguen publicadas, sin tu nombre. No se puede deshacer.
        {state.error && <div className="mt-1 font-semibold">{state.error}</div>}
      </div>
      <form action={action} className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-[10px] bg-danger px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          Borrar todo
        </button>
      </form>
    </div>
  );
}
