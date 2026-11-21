import { buenosAiresDay, type AdminUser, type Usage } from "./usage";

// Administración → Usuarios: the students in one panel per career, and the search across panels.
// Pure helpers, tested in by-career.test.ts. The grouping is done here, from the people admin_uso()
// already sends and the careers of the shared catalog cache: no extra database call.

export const NO_CAREER_KEY = "sin-carrera";

export interface CareerGroup {
  /** The career id, NO_CAREER_KEY, or "plan:<id>" for a plan that isn't in the catalog. */
  key: string;
  name: string;
  noPlan: boolean;
  /** In the same order they came (newest first). */
  users: AdminUser[];
  /** Used the app in the last 7 days; null if admin_uso() doesn't send it yet. */
  active7d: number | null;
}

interface CareerRef {
  id: string;
  shortName: string;
  plans: { id: string }[];
}

/**
 * One group per career that has students, the most numerous first (ties: catalog order), then plans
 * missing from the catalog, and "Sin carrera" last.
 */
export function groupUsersByCareer(
  users: readonly AdminUser[],
  careers: readonly CareerRef[],
  byCareer: Usage["byCareer"] | null,
): CareerGroup[] {
  const careerOfPlan = new Map(careers.flatMap((c, i) => c.plans.map((p) => [p.id, { career: c, order: i }] as const)));
  const groups = new Map<string, CareerGroup>();
  const order = new Map<string, number>();

  for (const u of users) {
    const found = u.planId ? careerOfPlan.get(u.planId) : undefined;
    const key = !u.planId ? NO_CAREER_KEY : found ? found.career.id : `plan:${u.planId}`;
    let group = groups.get(key);
    if (!group) {
      const active7d = !u.planId
        ? (byCareer?.find((r) => r.noPlan)?.active7d ?? null)
        : found
          ? (byCareer?.find((r) => r.id === found.career.id)?.active7d ?? null)
          : null;
      group = {
        key,
        name: !u.planId ? "Sin carrera" : found ? found.career.shortName : (u.plan ?? u.planId),
        noPlan: !u.planId,
        users: [],
        active7d,
      };
      order.set(key, found ? found.order : careers.length);
      groups.set(key, group);
    }
    group.users.push(u);
  }

  const rank = (g: CareerGroup) => (g.noPlan ? 2 : g.key.startsWith("plan:") ? 1 : 0);
  return [...groups.values()]
    .sort((a, b) => rank(a) - rank(b) || b.users.length - a.users.length || order.get(a.key)! - order.get(b.key)! || a.name.localeCompare(b.name, "es"));
}

/** "José Pérez" → "jose perez": lower case and without accents, for the search. */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Whether the name, mail or plan contains every word of the (normalized) query. */
export function userMatches(u: AdminUser, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const haystack = normalizeSearch(`${u.fullName} ${u.email} ${u.plan ?? ""}`);
  return normalizedQuery.split(/\s+/).every((word) => haystack.includes(word));
}

/** The groups with the students that match the query, without the groups left empty. */
export function filterGroups(groups: readonly CareerGroup[], query: string): { group: CareerGroup; matches: AdminUser[] }[] {
  const q = normalizeSearch(query);
  return groups
    .map((group) => ({ group, matches: q ? group.users.filter((u) => userMatches(u, q)) : group.users }))
    .filter((g) => g.matches.length > 0);
}

/** Signed up today, Buenos Aires day (the day of now, in that time zone). */
export function isNewToday(u: Pick<AdminUser, "createdAt">, now: number): boolean {
  const t = u.createdAt ? Date.parse(u.createdAt) : NaN;
  if (Number.isNaN(t) || Number.isNaN(now)) return false;
  return buenosAiresDay(u.createdAt) === buenosAiresDay(new Date(now).toISOString());
}

/** The students who signed up today, newest first. */
export function newToday(users: readonly AdminUser[], now: number): AdminUser[] {
  return users.filter((u) => isNewToday(u, now)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
