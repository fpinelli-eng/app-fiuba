export type PlanOption = {
  id: string;
  year: number;
  isCurrent: boolean;
  /** Career name when the plan was created, if it changed ("Ingeniería Electricista"). */
  legacyName: string | null;
};

export type CareerOption = {
  id: string;
  name: string;
  shortName: string;
  /** Current plan first, then the older ones. */
  plans: PlanOption[];
};

// "Ingeniería Electricista" → "Ing. Electricista", like the careers' short names.
export function shortCareerName(name: string): string {
  return name.replace(/^Ingeniería /, "Ing. ");
}

// "Plan 2023" and the line under it in the plan picker.
export function planCaption(plan: PlanOption): string {
  if (plan.isCurrent) return "Vigente";
  if (plan.legacyName) return shortCareerName(plan.legacyName);
  return "Para quienes ingresaron antes";
}
