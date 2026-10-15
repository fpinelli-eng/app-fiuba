import { createClient } from "@/lib/supabase/server";
import type { CareerOption } from "@/lib/plans";

// Careers and their plans, for the career picker (onboarding and profile).
export async function getCareers(): Promise<CareerOption[]> {
  const supabase = await createClient();
  const [careers, plans] = await Promise.all([
    supabase.from("careers").select("id, name, short_name").order("sort"),
    supabase.from("plans").select("id, career_id, year, is_current, legacy_name").order("sort"),
  ]);
  if (careers.error) throw new Error(`careers: ${careers.error.message}`);
  if (plans.error) throw new Error(`plans: ${plans.error.message}`);

  return careers.data.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    shortName: c.short_name as string,
    plans: plans.data
      .filter((p) => p.career_id === c.id)
      .map((p) => ({
        id: p.id as string,
        year: p.year as number,
        isCurrent: p.is_current as boolean,
        legacyName: (p.legacy_name as string | null) ?? null,
      }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.year - a.year),
  }));
}
