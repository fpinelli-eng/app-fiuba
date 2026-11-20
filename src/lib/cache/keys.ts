// Keys and tags of the shared catalog cache (shared.ts). Pure, so it is tested without Next.
//
// Every plan has its own entries: the key and the tags of anything that belongs to a plan carry
// its id (and the term id for the offer), so a student never gets another plan's subjects, offer
// or exam dates. Broader tags ("catalog", "offer:<term>", "scores"...) exist only to invalidate
// many plans at once when one write touches several of them.
//
// VERSION goes into every key: Vercel keeps these entries across deployments, so it is bumped
// whenever the shape of a cached value changes.

const VERSION = "v1";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export interface CacheSpec {
  /** Identifies the entry: name, then every argument the value depends on. */
  key: string[];
  /** For revalidateTag(). */
  tags: string[];
  /** Seconds: a safety net for writes that cannot call revalidateTag (migrations, GitHub Actions). */
  revalidate: number;
}

function need(value: string, what: string): string {
  if (!value) throw new Error(`cache: missing ${what}`);
  return value;
}

export const TAG = {
  /** Every plan's catalog (plans, subjects, prerequisites, areas, SIU codes) and the careers list. */
  catalog: "catalog",
  /** The current term. */
  terms: "terms",
  /** Every offer of every term and plan. */
  offer: "offer",
  /** Review scores of every offer (reviews belong to courses, shared by plans). */
  scores: "scores",
  /** Every plan's exam tables. */
  exams: "exams",
  /** Avisos of Novedades and FIUBA news. */
  news: "news",
  /** Academic calendar and its confirmed dates. */
  calendar: "calendar",
} as const;

export const catalogTag = (planId: string) => `catalog:${need(planId, "plan")}`;
/** Every plan's offer of one term. */
export const offerTermTag = (termId: string) => `offer:${need(termId, "term")}`;
export const offerTag = (termId: string, planId: string) => `offer:${need(termId, "term")}:${need(planId, "plan")}`;
export const examsTag = (planId: string) => `exams:${need(planId, "plan")}`;

export const SPEC = {
  /** Plan, career, subjects, requirements, areas, prerequisites and SIU codes of one plan. */
  planCatalog: (planId: string): CacheSpec => ({
    key: [VERSION, "plan-catalog", need(planId, "plan")],
    tags: [TAG.catalog, catalogTag(planId)],
    revalidate: HOUR,
  }),
  /** Subjects of one plan for the Reseñas search (no CBC, by name, as the database sorts them). */
  reviewSubjects: (planId: string): CacheSpec => ({
    key: [VERSION, "review-subjects", need(planId, "plan")],
    tags: [TAG.catalog, catalogTag(planId)],
    revalidate: HOUR,
  }),
  /** Careers and plans for the career picker (the same for everyone, no plan of the student). */
  careers: (): CacheSpec => ({ key: [VERSION, "careers"], tags: [TAG.catalog], revalidate: HOUR }),
  currentTerm: (): CacheSpec => ({ key: [VERSION, "current-term"], tags: [TAG.terms], revalidate: HOUR }),
  /** Visible offerings (with their schedule blocks) of one plan in one term. */
  termOffer: (termId: string, planId: string): CacheSpec => ({
    key: [VERSION, "term-offer", need(termId, "term"), need(planId, "plan")],
    tags: [TAG.offer, offerTermTag(termId), offerTag(termId, planId)],
    revalidate: HOUR,
  }),
  /** Star counts of the courses in one plan's offer of one term. */
  offerScores: (termId: string, planId: string): CacheSpec => ({
    key: [VERSION, "offer-scores", need(termId, "term"), need(planId, "plan")],
    tags: [TAG.scores, TAG.offer, offerTermTag(termId), offerTag(termId, planId)],
    revalidate: 10 * MINUTE,
  }),
  /**
   * Upcoming exam tables of one plan from `today`. The daily SIU sync (GitHub Actions) writes
   * straight into the database and cannot call revalidateTag: the hour is what bounds it.
   */
  examTables: (planId: string, today: string): CacheSpec => ({
    key: [VERSION, "exam-tables", need(planId, "plan"), need(today, "date")],
    tags: [TAG.exams, examsTag(planId)],
    revalidate: HOUR,
  }),
  /** Avisos, FIUBA news and important dates of Novedades (the same for every plan). */
  newsPage: (today: string): CacheSpec => ({
    key: [VERSION, "news-page", need(today, "date")],
    tags: [TAG.news, TAG.calendar],
    revalidate: HOUR,
  }),
};
