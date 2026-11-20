import type { DisplayState } from "@/lib/map/model";

// "Para cursar" / "Toda la oferta" en el Plan: lógica pura de qué materias se listan y cómo se
// marcan las que el alumno todavía no puede cursar (o ya aprobó).

/**
 * Whether the student can take a subject this term, from their map:
 * - "ok": enabled or in progress, or already in the confirmed cursada of this term (passing the
 *   cursada or the final mid-term does not end the classes).
 * - "missing": prerequisites or credits missing.
 * - "final_pending" / "approved": the cursada is already passed.
 */
export type Eligibility = "ok" | "missing" | "final_pending" | "approved";

export function eligibilityOf(state: DisplayState, confirmedThisTerm: boolean): Eligibility {
  if (confirmedThisTerm || state === "enabled" || state === "in_progress") return "ok";
  if (state === "approved") return "approved";
  if (state === "final_pending") return "final_pending";
  return "missing";
}

/** What the subject list says next to a subject the student cannot take (null for "ok"). */
export const ELIGIBILITY_LABEL: Record<Eligibility, string | null> = {
  ok: null,
  missing: "Te faltan correlativas",
  final_pending: "Ya la cursaste",
  approved: "Ya aprobada",
};

/** The short tag on its classes in the weekly grid. */
export const ELIGIBILITY_TAG: Record<Eligibility, string | null> = {
  ok: null,
  missing: "Sin correlativas",
  final_pending: "Ya cursada",
  approved: "Aprobada",
};

/**
 * Subjects without their prerequisites can be added to compare times. Already passed ones are
 * listed but not added: there is nothing to plan (they can still be removed if they were in an option).
 */
export const canAdd = (e: Eligibility): boolean => e === "ok" || e === "missing";

/** "Confirmar mi cursada" only takes what the map lets the student take. */
export const canConfirm = (e: Eligibility): boolean => e === "ok";

export type PlanFilter = "cursar" | "oferta";
export const PLAN_FILTERS: PlanFilter[] = ["cursar", "oferta"];
export const isPlanFilter = (v: unknown): v is PlanFilter => v === "cursar" || v === "oferta";

export const removeAccents = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const RANK: Record<Eligibility, number> = { ok: 0, missing: 1, final_pending: 2, approved: 3 };

/**
 * The subjects of the list, in the order they come (group, level, name), searched by name.
 * "cursar": what the student can take, plus whatever is already in option A or B (so nothing on
 * the grid disappears from the list). "oferta": the whole published offer of the plan, with what
 * they can take first and what they already passed last.
 */
export function listedSubjects<S extends { code: string; name: string; eligibility: Eligibility }>(
  subjects: S[],
  filter: PlanFilter,
  query: string,
  inOptions: ReadonlySet<string>,
): S[] {
  const q = removeAccents(query.trim());
  const list = subjects.filter(
    (s) =>
      (filter === "oferta" || s.eligibility === "ok" || inOptions.has(s.code)) && (!q || removeAccents(s.name).includes(q)),
  );
  if (filter === "cursar") return list;
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => RANK[a.s.eligibility] - RANK[b.s.eligibility] || a.i - b.i)
    .map(({ s }) => s);
}
