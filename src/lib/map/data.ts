import { createClient } from "@/lib/supabase/server";
import type { Requirement, Subject, SubjectKind, SubjectStatus } from "./model";

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
    subjects: { subjectId: number; status: SubjectStatus; grade: number | null }[];
    requirements: number[];
  };
}

// Everything the map needs for the student's plan, in one round of queries.
export async function getMapData(userId: string, planId: string): Promise<MapData> {
  const supabase = await createClient();

  const [plan, subjects, requirements, userRequirements, areas] = await Promise.all([
    supabase.from("plans").select("id, year, credit_rules, careers(name)").eq("id", planId).single(),
    supabase
      .from("subjects")
      .select("id, code, name, credits, kind, category, level, required_credits, requires_cbc, sort, area_id")
      .eq("plan_id", planId)
      .order("sort"),
    supabase.from("plan_requirements").select("id, name, short_name").eq("plan_id", planId).order("sort"),
    supabase.from("user_requirements").select("requirement_id").eq("user_id", userId),
    supabase.from("subject_areas").select("id, name, sort").eq("plan_id", planId),
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
    supabase.from("user_subjects").select("subject_id, status, grade, updated_at").eq("user_id", userId).in("subject_id", ids),
  ]);
  if (prerequisites.error) throw new Error(`subject_prerequisites: ${prerequisites.error.message}`);
  if (userSubjects.error) throw new Error(`user_subjects: ${userSubjects.error.message}`);

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
    lastChange: userSubjects.data.reduce<string | null>((max, u) => {
      const t = u.updated_at as string;
      return !max || t > max ? t : max;
    }, null),
    progress: {
      subjects: userSubjects.data.map((u) => ({
        subjectId: u.subject_id as number,
        status: u.status as SubjectStatus,
        grade: (u.grade as number | null) ?? null,
      })),
      requirements: userRequirements.data
        .map((r) => r.requirement_id as number)
        .filter((id) => requirementIds.has(id)),
    },
  };
}
