import { createClient } from "@/lib/supabase/server";

// Subjects of a plan and the SIU codes already known for them: what previewImport needs.
// Used by the admin import and by the offer students send (any member reads the catalog).

export async function getPlanCatalog(planId: string) {
  const supabase = await createClient();
  const subjects = await supabase.from("subjects").select("id, name").eq("plan_id", planId);
  if (subjects.error) throw new Error(`subjects: ${subjects.error.message}`);
  const ids = subjects.data.map((s) => s.id as number);
  const codes = await supabase.from("subject_siu_codes").select("subject_id, siu_code").in("subject_id", ids);
  if (codes.error) throw new Error(`subject_siu_codes: ${codes.error.message}`);
  return {
    subjects: subjects.data.map((s) => ({ id: s.id as number, name: s.name as string })),
    knownCodes: new Map(codes.data.map((c) => [c.siu_code as string, c.subject_id as number])),
  };
}
