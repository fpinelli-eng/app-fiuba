import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, type Account } from "@/lib/session";
import type { ImportPreview } from "./offer-import";

// Reads for the admin screen. Writes are in src/app/admin/actions.ts.
// Admins see hidden offerings too (RLS): here that is what we want.

/** Only admins get past this; everyone else goes back to the app. */
export async function requireAdmin(): Promise<Account> {
  const account = await requireProfile();
  if (!account.isAdmin) redirect("/");
  return account;
}

export interface Term {
  id: string; // '2026-2C'
  year: number;
  half: 1 | 2;
  reviewsOpenOn: string | null; // 'YYYY-MM-DD'
}

export type ImportStatus = "empty" | "processed" | "published";

export interface PlanRow {
  id: string;
  career: string; // 'Ing. Industrial'
  year: number;
  status: ImportStatus;
}

export interface PublishedCourse {
  id: number;
  label: string;
  teachers: string[];
  visible: boolean;
  blocks: { weekday: number; startsAt: number; endsAt: number; campus: string | null; isAsync: boolean }[];
}

export interface PublishedSubject {
  siuCode: string;
  name: string;
  courses: PublishedCourse[];
}

export interface AdminOverview {
  term: Term | null;
  plans: PlanRow[];
}

/** "2C 2026" */
export const termLabel = (t: Pick<Term, "year" | "half">) => `${t.half}C ${t.year}`;

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient();
  const [term, plans] = await Promise.all([
    supabase.from("terms").select("id, year, half, reviews_open_on").eq("is_current", true).maybeSingle(),
    supabase.from("plans").select("id, year, sort, careers(short_name, sort)"),
  ]);
  if (term.error) throw new Error(`terms: ${term.error.message}`);
  if (plans.error) throw new Error(`plans: ${plans.error.message}`);

  const statusByPlan = new Map<string, ImportStatus>();
  if (term.data) {
    const imports = await supabase.from("offer_imports").select("plan_id, status").eq("term_id", term.data.id);
    if (imports.error) throw new Error(`offer_imports: ${imports.error.message}`);
    for (const i of imports.data) statusByPlan.set(i.plan_id as string, i.status as ImportStatus);
  }

  type CareerRef = { short_name: string; sort: number };
  const careerOf = (row: { careers: unknown }): CareerRef => {
    const c = row.careers as CareerRef | CareerRef[] | null;
    return (Array.isArray(c) ? c[0] : c) ?? { short_name: "", sort: 0 };
  };

  return {
    term: term.data
      ? {
          id: term.data.id as string,
          year: term.data.year as number,
          half: term.data.half as 1 | 2,
          reviewsOpenOn: (term.data.reviews_open_on as string | null) ?? null,
        }
      : null,
    plans: plans.data
      .map((p) => ({ p, career: careerOf(p) }))
      .sort((a, b) => a.career.sort - b.career.sort || a.career.short_name.localeCompare(b.career.short_name, "es") || (b.p.year as number) - (a.p.year as number))
      .map(({ p, career }) => ({
        id: p.id as string,
        career: career.short_name,
        year: p.year as number,
        status: statusByPlan.get(p.id as string) ?? "empty",
      })),
  };
}

export interface PlanImport {
  status: Exclude<ImportStatus, "empty">;
  preview: ImportPreview;
  publishedAt: string | null;
}

export async function getPlanImport(termId: string, planId: string): Promise<PlanImport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_imports")
    .select("status, parsed, published_at")
    .eq("term_id", termId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (error) throw new Error(`offer_imports: ${error.message}`);
  if (!data) return null;
  return {
    status: data.status as PlanImport["status"],
    preview: data.parsed as ImportPreview,
    publishedAt: (data.published_at as string | null) ?? null,
  };
}

export async function getPublishedOffer(termId: string, planId: string): Promise<PublishedSubject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offerings")
    .select("id, siu_subject_code, siu_subject_name, label, teachers, visible, offering_blocks(weekday, starts_at, ends_at, campus, is_async)")
    .eq("term_id", termId)
    .eq("plan_id", planId)
    .order("siu_subject_name")
    .order("course_number")
    .order("practice", { nullsFirst: true });
  if (error) throw new Error(`offerings: ${error.message}`);

  const subjects = new Map<string, PublishedSubject>();
  for (const o of data) {
    const code = o.siu_subject_code as string;
    const subject = subjects.get(code) ?? { siuCode: code, name: o.siu_subject_name as string, courses: [] };
    subjects.set(code, subject);
    const blocks = (o.offering_blocks ?? []) as { weekday: number; starts_at: number; ends_at: number; campus: string | null; is_async: boolean }[];
    subject.courses.push({
      id: o.id as number,
      label: o.label as string,
      teachers: ((o.teachers ?? []) as { nombre: string }[]).map((t) => t.nombre),
      visible: o.visible as boolean,
      blocks: blocks
        .map((b) => ({ weekday: b.weekday, startsAt: b.starts_at, endsAt: b.ends_at, campus: b.campus, isAsync: b.is_async }))
        .sort((a, b) => a.weekday - b.weekday || a.startsAt - b.startsAt),
    });
  }
  return [...subjects.values()];
}
