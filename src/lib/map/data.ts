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

// Everything the map needs for the student's plan, in one round of queries.
export async function getMapData(userId: string, planId: string): Promise<MapData> {
  const supabase = await createClient();

  const [plan, subjects, requirements, userRequirements, areas, extras] = await Promise.all([
    supabase.from("plans").select("id, year, credit_rules, careers(name)").eq("id", planId).single(),
    supabase
      .from("subjects")
      .select("id, code, name, credits, kind, category, level, required_credits, requires_cbc, sort, area_id")
      .eq("plan_id", planId)
      .order("sort"),
    supabase.from("plan_requirements").select("id, name, short_name").eq("plan_id", planId).order("sort"),
    supabase.from("user_requirements").select("requirement_id").eq("user_id", userId),
    supabase.from("subject_areas").select("id, name, sort").eq("plan_id", planId),
    getExtras(userId),
  ]);
  if (plan.error) throw new Error(`plans: ${plan.error.message}`);
  if (subjects.error) throw new Error(`subjects: ${subjects.error.message}`);
  if (requirements.error) throw new Error(`plan_requirements: ${requirements.error.message}`);
  if (userRequirements.error) throw new Error(`user_requirements: ${userRequirements.error.message}`);
  if (areas.error) throw new Error(`subject_areas: ${areas.error.message}`);
  const areaById = new Map(areas.data.map((a) => [a.id as number, { name: a.name as string, sort: a.sort as number }]));

  const ids = subjects.data.map((s) => s.id as number);
  const [prerequisites, userSubjects] = await Promise.all([
    supabase.from("subject_prerequisites").select("subject_id, prerequisite_id").in("subject_id", ids),
    getUserSubjects(userId, ids),
  ]);
  if (prerequisites.error) throw new Error(`subject_prerequisites: ${prerequisites.error.message}`);

  const prereqsOf = new Map<number, number[]>();
  for (const p of prerequisites.data) {
    const list = prereqsOf.get(p.subject_id as number) ?? [];
    list.push(p.prerequisite_id as number);
    prereqsOf.set(p.subject_id as number, list);
  }

  const career = plan.data.careers as unknown as { name: string } | { name: string }[] | null;
  const careerName = Array.isArray(career) ? (career[0]?.name ?? "") : (career?.name ?? "");
  const requirementIds = new Set(requirements.data.map((r) => r.id as number));

  return {
    planId,
    careerName,
    year: plan.data.year as number,
    creditRules: plan.data.credit_rules,
    subjects: subjects.data.map((s) => ({
      id: s.id as number,
      code: s.code as string,
      name: s.name as string,
      credits: s.credits as number,
      kind: s.kind as SubjectKind,
      category: s.category as string,
      level: (s.level as number | null) ?? null,
      requiredCredits: (s.required_credits as number | null) ?? null,
      requiresCbc: s.requires_cbc === true,
      prerequisites: prereqsOf.get(s.id as number) ?? [],
      sort: s.sort as number,
      area: s.area_id ? (areaById.get(s.area_id as number) ?? null) : null,
    })),
    requirements: requirements.data.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      shortName: r.short_name as string,
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
}
