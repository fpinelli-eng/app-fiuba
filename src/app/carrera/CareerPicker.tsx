"use client";

import { useActionState, useState, type ReactNode } from "react";
import { planCaption, type CareerOption } from "@/lib/plans";
import { choosePlan, type ChoosePlanState } from "./actions";

export function CareerPicker({ careers }: { careers: CareerOption[] }) {
  const [careerId, setCareerId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ChoosePlanState, FormData>(choosePlan, { error: null });

  const career = careers.find((c) => c.id === careerId) ?? null;

  function pickCareer(c: CareerOption) {
    setCareerId(c.id);
    setPlanId(c.plans[0]?.id ?? null); // el vigente viene marcado
  }

  return (
    <form action={action} className="flex flex-col gap-[22px]">
      <div role="radiogroup" aria-label="Carrera" className="grid grid-cols-2 gap-2">
        {careers.map((c) => (
          <Option key={c.id} checked={c.id === careerId} onPick={() => pickCareer(c)}>
            {c.shortName}
          </Option>
        ))}
      </div>

      {career && career.plans.length > 1 && (
        <div>
          <div className="mb-2 font-semibold">Plan de estudios</div>
          <div role="radiogroup" aria-label="Plan de estudios" className="grid grid-cols-3 gap-2">
            {career.plans.map((p) => (
              <Option key={p.id} checked={p.id === planId} onPick={() => setPlanId(p.id)}>
                <span>
                  Plan {p.year}
                  <span className="block text-[13px] font-normal text-muted">{planCaption(p)}</span>
                </span>
              </Option>
            ))}
          </div>
        </div>
      )}

      <input type="hidden" name="plan" value={planId ?? ""} />

      <div className="flex items-center justify-end gap-4">
        {state.error && (
          <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={!planId || pending}
          className="h-[46px] rounded-xl bg-accent px-[26px] text-[15px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink"
        >
          Continuar
        </button>
      </div>
    </form>
  );
}

function Option({ checked, onPick, children }: { checked: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className={`flex items-center justify-between gap-2.5 rounded-xl px-4 py-3.5 text-left ${
        checked
          ? "border-[1.5px] border-accent bg-accent-soft font-semibold"
          : "border border-line bg-surface hover:border-line-strong"
      }`}
    >
      {children}
      {checked && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-accent"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}
