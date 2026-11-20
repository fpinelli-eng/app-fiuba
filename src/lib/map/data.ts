import { cache } from "react";
import { getSharedPlan } from "@/lib/cache/catalog";
import { createClient } from "@/lib/supabase/server";
import type { ExtraCredit, ExtraCreditKind, Requirement, Subject, SubjectKind, SubjectStatus } from "./model";

export interface MapData {
  planId: string;
  /** "Ingeniería Industrial" */
  careerName: string;
  year: number;
  creditRules: unknown;
  subjects: Subject[];
  requirements: Requirement[];
  /** Last time the student changed a subject (ISO date), or null. */
  lastChange: string | null;
  /** Serializable progress (server → client). */
  progress: {
    subjects: { subjectId: number; status: SubjectStatus; grade: number | null; equivalence: boolean }[];
    requirements: number[];
    extraCredits: ExtraCredit[];
  };
  /**
   * The database has user_subjects.by_equivalence (migration 20261119120000_equivalencia). Until
   * it is applied (Vercel previews use the production database) the map hides "Por equivalencia".
   */
  equivalenceReady: boolean;
  /** Failed finals (aplazos) the student entered. Not used by the average yet. */
  failedFinals: number;
}

// Undefined table or column: the migration 20261107140000_extra_credits is not applied yet. Vercel
// previews use the production database, which only gets it when the branch is merged.
const NOT_YET = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

// Same for by_equivalence (migration 20261119120000_equivalencia): without the column, the grade alone.
const EQUIVALENCE_NOT_YET = new Set(["42703", "PGRST204", "42P01", "42883", "PGRST202"]);

async function getUserSubjects(userId: string, ids: number[]) {
  const supabase = await createClient();
  const query = (columns: string) => supabase.from("user_subjects").select(columns).eq("user_id", userId).in("subject_id", ids);
  type Row = { subject_id: number; status: string; grade: number | null; updated_at: string; by_equivalence?: boolean };
  const full = await query("subject_id, status, grade, updated_at, by_equivalence");
  if (!full.error) return { rows: full.data as unknown as Row[], equivalenceReady: true };
  if (!EQUIVALENCE_NOT_YET.has(full.error.code)) throw new Error(`user_subjects: ${full.error.message}`);
  const basic = await query("subject_id, status, grade, updated_at");
  if (basic.error) throw new Error(`user_subjects: ${basic.error.message}`);
  return { rows: basic.data as unknown as Row[], equivalenceReady: false };
}

async function getExtras(userId: string): Promise<{ extraCredits: ExtraCredit[]; failedFinals: number }> {
  const supabase = await createClient();
  const [extras, profile] = await Promise.all([
    supabase.from("user_extra_credits").select("id, name, credits, kind").eq("user_id", userId).order("created_at"),
    supabase.from("profiles").select("failed_finals").eq("id", userId).maybeSingle(),
  ]);
  if (extras.error && !NOT_YET.has(extras.error.code)) throw new Error(`user_extra_credits: ${extras.error.message}`);
  if (profile.error && !NOT_YET.has(profile.error.code)) throw new Error(`profiles: ${profile.error.message}`);
  return {
    extraCredits: (extras.data ?? []).map((e) => ({
      id: e.id as number,
      name: e.name as string,
      credits: e.credits as number,
      kind: e.kind as ExtraCreditKind,
    })),
    failedFinals: (profile.data?.failed_finals as number | undefined) ?? 0,
  };
}

// Everything the map needs for the student's plan: the plan itself from the shared cache
// (src/lib/cache/), the student's progress from the database. cache() dedupes within a request.
export const getMapData = cache(async (userId: string, planId: string): Promise<MapData> => {
  const supabase = await createClient();

  const [plan, userRequirements, extras] = await Promise.all([
    getSharedPlan(planId),
    supabase.from("user_requirements").select("requirement_id").eq("user_id", userId),
    getExtras(userId),
  ]);
  if (userRequirements.error) throw new Error(`user_requirements: ${userRequirements.error.message}`);
  const areaById = new Map(plan.areas.map((a) => [a.id, { name: a.name, sort: a.sort }]));

  const userSubjects = await getUserSubjects(userId, plan.subjects.map((s) => s.id));

  const prereqsOf = new Map<number, number[]>();
  for (const p of plan.prerequisites) {
    const list = prereqsOf.get(p.subject_id) ?? [];
    list.push(p.prerequisite_id);
    prereqsOf.set(p.subject_id, list);
  }

  const requirementIds = new Set(plan.requirements.map((r) => r.id));

  return {
    planId,
    careerName: plan.careerName,
    year: plan.year,
    creditRules: plan.creditRules,
    subjects: plan.subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      credits: s.credits,
      kind: s.kind as SubjectKind,
      category: s.category,
      level: s.level ?? null,
      requiredCredits: s.required_credits ?? null,
      requiresCbc: s.requires_cbc === true,
      prerequisites: prereqsOf.get(s.id) ?? [],
      sort: s.sort,
      area: s.area_id ? (areaById.get(s.area_id) ?? null) : null,
    })),
    requirements: plan.requirements.map((r) => ({
      id: r.id,
      name: r.name,
      shortName: r.short_name,
    })),
    lastChange: userSubjects.rows.reduce<string | null>((max, u) => {
      const t = u.updated_at;
      return !max || t > max ? t : max;
    }, null),
    progress: {
      subjects: userSubjects.rows.map((u) => ({
        subjectId: u.subject_id,
        status: u.status as SubjectStatus,
        grade: u.grade ?? null,
        equivalence: u.by_equivalence === true,
      })),
      requirements: userRequirements.data
        .map((r) => r.requirement_id as number)
        .filter((id) => requirementIds.has(id)),
      extraCredits: extras.extraCredits,
    },
    failedFinals: extras.failedFinals,
    equivalenceReady: userSubjects.equivalenceReady,
  };
});
