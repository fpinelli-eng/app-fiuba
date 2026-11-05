"use client";

import { useActionState, useId, useState } from "react";
import { planCaption, type CareerOption } from "@/lib/plans";
import { changePlan, type ChangePlanState } from "./actions";

// Tarjeta "Carrera" del perfil (prototipo 12-perfil): "Cambiar" abre los selectores de carrera y
// plan. Sin equivalencias: si el plan cambia, se avisa que se borran las materias cargadas.
export function CareerChange({ careers, planId }: { careers: CareerOption[]; planId: string }) {
  const current = careers.find((c) => c.plans.some((p) => p.id === planId)) ?? careers[0];
  const currentPlan = current?.plans.find((p) => p.id === planId);
  const [open, setOpen] = useState(false);
  const [careerId, setCareerId] = useState(current?.id ?? "");
  const [newPlanId, setNewPlanId] = useState(planId);
  const [state, action, pending] = useActionState<ChangePlanState, FormData>(changePlan, { error: null });
  const careerSelect = useId();
  const planSelect = useId();
  const warning = useId();

  const career = careers.find((c) => c.id === careerId);
  const changes = newPlanId !== planId;

  function cancel() {
    setOpen(false);
    setCareerId(current?.id ?? "");
    setNewPlanId(planId);
  }

  return (
    <section aria-labelledby="carrera-titulo" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface px-4 py-[18px] md:px-6 md:py-[22px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="carrera-titulo" className="text-[19px] font-semibold">
            Carrera
          </h2>
          <div className="mt-0.5 text-muted">
            {current?.shortName} · Plan {currentPlan?.year}
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold"
          >
            Cambiar
          </button>
        )}
      </div>

      {open && (
        <form action={action} className="flex flex-col gap-3.5 border-t border-line pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={careerSelect} className="text-[13px] font-semibold text-muted">
                Carrera
              </label>
              <select
                id={careerSelect}
                value={careerId}
                onChange={(e) => {
                  const c = careers.find((x) => x.id === e.target.value);
                  setCareerId(e.target.value);
                  setNewPlanId(c?.plans[0]?.id ?? ""); // el vigente viene marcado
                }}
                className="h-[42px] rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink md:text-sm"
              >
                {careers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={planSelect} className="text-[13px] font-semibold text-muted">
                Plan
              </label>
              <select
                id={planSelect}
                name="plan"
                value={newPlanId}
                onChange={(e) => setNewPlanId(e.target.value)}
                aria-describedby={changes ? warning : undefined}
                className="h-[42px] rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink md:text-sm"
              >
                {career?.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    Plan {p.year} · {planCaption(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {changes && (
            <p id={warning} className="rounded-xl bg-butter px-3.5 py-3 text-sm text-butter-ink">
              Se borran las materias que cargaste y tu plan del cuatrimestre: las cargás de nuevo en el plan nuevo. Tus
              reseñas no cambian.
            </p>
          )}
          {state.error && (
            <p role="alert" className="rounded-xl bg-peach px-3.5 py-3 text-sm text-peach-ink">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!changes || pending}
              className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
