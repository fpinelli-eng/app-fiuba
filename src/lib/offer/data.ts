import { createClient } from "@/lib/supabase/server";
import type { MySubmission, SubmissionStatus } from "./submission";

// Reads of the offer students send. Server only. Writes: src/app/(app)/plan/actions.ts.

// Undefined table: the migration 20261112120000_offer_submissions is not applied yet. Vercel
// previews use the production database, which only gets it when the branch is merged.
export const NOT_YET = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

/** The latest offer this student sent for their plan and this term (RLS: only their own). */
export async function getMySubmission(userId: string, termId: string, planId: string): Promise<MySubmission | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_submissions")
    .select("status, created_at, subjects, courses")
    .eq("submitted_by", userId)
    .eq("term_id", termId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (NOT_YET.has(error.code)) return null;
    throw new Error(`offer_submissions: ${error.message}`);
  }
  if (!data) return null;
  return {
    status: data.status as SubmissionStatus,
    createdAt: data.created_at as string,
    subjects: data.subjects as number,
    courses: data.courses as number,
  };
}
