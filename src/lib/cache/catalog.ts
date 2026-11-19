import { cache } from "react";
import { SPEC } from "./keys";
import { sharedRead } from "./shared";

// Shared, read-mostly data of a plan, served from the cache (shared.ts). React cache() on top
// also dedupes calls within one request (layout and page asking for the same thing).
// Server only. Values are plain JSON: callers build their Maps.

export interface SharedPlan {
  year: number;
  creditRules: unknown;
  /** "Ingeniería Industrial" */
  careerName: string;
  /** Ordered by `sort`. */
  subjects: {
    id: number;
    code: string;
    name: string;
    credits: number;
    kind: string;
    category: string;
    level: number | null;
    required_credits: number | null;
    requires_cbc: boolean;
    sort: number;
    area_id: number | null;
  }[];
  requirements: { id: number; name: string; short_name: string }[];
  areas: { id: number; name: string; sort: number }[];
  prerequisites: { subject_id: number; prerequisite_id: number }[];
  siuCodes: { subject_id: number; siu_code: string }[];
}

/** Everything about one plan that is the same for all its students. */
export const getSharedPlan = cache((planId: string) =>
  sharedRead(SPEC.planCatalog(planId), async (db): Promise<SharedPlan> => {
    const [plan, subjects, requirements, areas] = await Promise.all([
      db.from("plans").select("id, year, credit_rules, careers(name)").eq("id", planId).single(),
      db
        .from("subjects")
        .select("id, code, name, credits, kind, category, level, required_credits, requires_cbc, sort, area_id")
        .eq("plan_id", planId)
        .order("sort"),
      db.from("plan_requirements").select("id, name, short_name").eq("plan_id", planId).order("sort"),
      db.from("subject_areas").select("id, name, sort").eq("plan_id", planId),
    ]);
    if (plan.error) throw new Error(`plans: ${plan.error.message}`);
    if (subjects.error) throw new Error(`subjects: ${subjects.error.message}`);
    if (requirements.error) throw new Error(`plan_requirements: ${requirements.error.message}`);
    if (areas.error) throw new Error(`subject_areas: ${areas.error.message}`);

    const ids = subjects.data.map((s) => s.id as number);
    const [prerequisites, codes] = await Promise.all([
      db.from("subject_prerequisites").select("subject_id, prerequisite_id").in("subject_id", ids),
      db.from("subject_siu_codes").select("subject_id, siu_code").in("subject_id", ids),
    ]);
    if (prerequisites.error) throw new Error(`subject_prerequisites: ${prerequisites.error.message}`);
    if (codes.error) throw new Error(`subject_siu_codes: ${codes.error.message}`);

    const career = plan.data.careers as unknown as { name: string } | { name: string }[] | null;
    return {
      year: plan.data.year as number,
      creditRules: plan.data.credit_rules,
      careerName: Array.isArray(career) ? (career[0]?.name ?? "") : (career?.name ?? ""),
      subjects: subjects.data as SharedPlan["subjects"],
      requirements: requirements.data as SharedPlan["requirements"],
      areas: areas.data as SharedPlan["areas"],
      prerequisites: prerequisites.data as SharedPlan["prerequisites"],
      siuCodes: codes.data as SharedPlan["siuCodes"],
    };
  }),
);

/** Subjects of the plan with courses (no CBC), ordered by name as the database sorts them. */
export const getReviewSubjects = cache((planId: string) =>
  sharedRead(SPEC.reviewSubjects(planId), async (db) => {
    const { data, error } = await db
      .from("subjects")
      .select("id, name, credits, kind")
      .eq("plan_id", planId)
      .not("kind", "in", "(cbc,cbc_subject)")
      .order("name");
    if (error) throw new Error(`subjects: ${error.message}`);
    return data as { id: number; name: string; credits: number; kind: string }[];
  }),
);

export interface TermRow {
  /** "2026-2C" */
  id: string;
  year: number;
  half: number;
}

/** The current term, or null when an admin did not open one. */
export const getCurrentTermRow = cache(() =>
  sharedRead(SPEC.currentTerm(), async (db): Promise<TermRow | null> => {
    const { data, error } = await db.from("terms").select("id, year, half").eq("is_current", true).maybeSingle();
    if (error) throw new Error(`terms: ${error.message}`);
    return data ? { id: data.id as string, year: data.year as number, half: data.half as number } : null;
  }),
);

export interface OfferRow {
  id: number;
  course_id: number;
  term_id: string;
  plan_id: string;
  siu_subject_code: string;
  siu_subject_name: string;
  course_number: string | null;
  practice: string | null;
  label: string;
  modality: string | null;
  teachers: { nombre: string; rol: string }[] | null;
  quota: number | null;
  enrolled: number | null;
  offering_blocks: {
    weekday: number;
    starts_at: number;
    ends_at: number;
    class_type: string | null;
    room: string | null;
    campus: string | null;
    is_async: boolean;
  }[];
}

/**
 * The plan's visible offerings of a term, with their schedule blocks. Admins could also read
 * hidden ones: the filter is explicit, so the cached offer is the students' one.
 */
export const getTermOffer = cache((termId: string, planId: string) =>
  sharedRead(SPEC.termOffer(termId, planId), async (db) => {
    const { data, error } = await db
      .from("offerings")
      .select(
        "id, course_id, term_id, plan_id, siu_subject_code, siu_subject_name, course_number, practice, label, modality, teachers, quota, enrolled, offering_blocks(weekday, starts_at, ends_at, class_type, room, campus, is_async)",
      )
      .eq("term_id", termId)
      .eq("plan_id", planId)
      .eq("visible", true);
    if (error) throw new Error(`offerings: ${error.message}`);
    return data as unknown as OfferRow[];
  }),
);

export type StarCountRow = { course_id: number; app: number[] | null; dolly: number[] | null };

/**
 * Star counts (app reviews and Dolly opinions, never hidden ones) of the courses in the plan's
 * offer of a term. Revalidated when a review is written or moderated (tag "scores").
 */
export const getOfferStarCounts = cache(async (termId: string, planId: string): Promise<StarCountRow[]> => {
  const offer = await getTermOffer(termId, planId);
  const courseIds = [...new Set(offer.map((o) => o.course_id))].sort((a, b) => a - b);
  if (!courseIds.length) return [];
  return sharedRead(SPEC.offerScores(termId, planId), async (db) => {
    const { data, error } = await db.rpc("course_star_counts", { course_ids: courseIds });
    if (error) throw new Error(`course_star_counts: ${error.message}`);
    return data as StarCountRow[];
  });
});
