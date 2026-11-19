import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SPEC } from "@/lib/cache/keys";
import { sharedRead } from "@/lib/cache/shared";
import type { CareerOption } from "@/lib/plans";

// Careers and their plans, for the career picker (onboarding and profile). The same for everyone:
// shared cache (src/lib/cache/).
export const getCareers = cache(() => sharedRead(SPEC.careers(), readCareers));

async function readCareers(supabase: SupabaseClient): Promise<CareerOption[]> {
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
