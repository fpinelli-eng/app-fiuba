"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import type { OptionKey } from "@/lib/plan/data";

export type SaveResult = { error: string | null };

// Guarda una opción del plan (A o B) completa: la reemplaza por los cursos que recibe.
// La base controla que sean cursos visibles del plan del alumno.
export async function savePlanOption(option: OptionKey, courseIds: string[]): Promise<SaveResult> {
  const account = await requireProfile();
  if (option !== "A" && option !== "B") return { error: "Opción inválida." };
  const ids = courseIds.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0) || ids.length > 40) return { error: "Cursos inválidos." };

  const supabase = await createClient();
  const removed = await supabase.from("plan_choices").delete().eq("user_id", account.id).eq("option", option);
  if (removed.error) return { error: "No pudimos guardar tu plan." };
  if (ids.length) {
    const added = await supabase
      .from("plan_choices")
      .insert(ids.map((offering_id) => ({ user_id: account.id, option, offering_id })));
    if (added.error) return { error: "No pudimos guardar tu plan." };
  }
  return { error: null };
}
