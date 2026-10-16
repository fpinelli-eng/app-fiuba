"use server";

import { revalidatePath } from "next/cache";
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

// "Me inscribí en esta opción": esos cursos pasan a ser la cursada del cuatrimestre actual
// (user_courses), de donde salen las reseñas pendientes. Reemplaza la cursada de este
// cuatrimestre; las de cuatrimestres anteriores no se tocan.
export async function enrollInCourses(courseIds: string[]): Promise<SaveResult> {
  const account = await requireProfile();
  const ids = courseIds.map(Number);
  if (ids.length === 0 || ids.length > 40 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { error: "Elegí al menos un curso." };
  }

  const supabase = await createClient();
  const term = await supabase.from("terms").select("id").eq("is_current", true).maybeSingle();
  if (term.error || !term.data) return { error: "No hay un cuatrimestre abierto." };

  // This term's courses the student had marked before.
  const current = await supabase
    .from("user_courses")
    .select("offering_id, offerings!inner(term_id)")
    .eq("user_id", account.id)
    .eq("offerings.term_id", term.data.id);
  if (current.error) return { error: "No pudimos guardar tu cursada." };
  const previous = current.data.map((c) => c.offering_id as number);

  if (previous.length) {
    const removed = await supabase.from("user_courses").delete().eq("user_id", account.id).in("offering_id", previous);
    if (removed.error) return { error: "No pudimos guardar tu cursada." };
  }
  const added = await supabase.from("user_courses").insert(ids.map((offering_id) => ({ user_id: account.id, offering_id })));
  if (added.error) {
    // Put back what was there, so a failure does not leave the student without courses.
    if (previous.length) {
      await supabase.from("user_courses").insert(previous.map((offering_id) => ({ user_id: account.id, offering_id })));
    }
    return { error: "No pudimos guardar tu cursada." };
  }
  revalidatePath("/");
  return { error: null };
}
