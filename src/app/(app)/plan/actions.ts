"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import type { Entry, OptionKey } from "@/lib/plan/data";
import { getPlanCatalog } from "@/lib/admin/catalog";
import { previewImport } from "@/lib/admin/offer-import";
import { NOT_YET } from "@/lib/offer/data";
import { offerPreviewProblem, offerTextProblem } from "@/lib/offer/check";
import { submissionRefusal, submissionSummary } from "@/lib/offer/submission";

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

// "Confirmar mi cursada": los cursos en los que el alumno quedó pasan a ser la cursada del
// cuatrimestre actual (user_courses), de donde salen el calendario del Inicio y las reseñas
// pendientes. Reemplaza la cursada de este cuatrimestre (sin cursos, la borra); las de
// cuatrimestres anteriores no se tocan. Las opciones A y B (plan_choices) tampoco: son borradores.
// En el mapa, sus materias quedan "Cursando", y las de la cursada anterior que ya no están
// vuelven a quedar sin marcar (solo si estaban en "Cursando": nunca toca aprobadas ni finales).
export async function confirmCourses(entries: Entry[], droppedSubjects: string[]): Promise<SaveResult> {
  const account = await requireProfile();
  const ids = entries.map((e) => Number(e.course));
  const subjectIds = entries.map((e) => Number(e.subject));
  const dropped = droppedSubjects.map(Number).filter((id) => !subjectIds.includes(id));
  if ([...subjectIds, ...dropped].some((id) => !Number.isInteger(id) || id <= 0)) return { error: "Materias inválidas." };
  if (ids.length > 40 || ids.some((id) => !Number.isInteger(id) || id <= 0)) return { error: "Cursos inválidos." };

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
  const added = ids.length
    ? await supabase.from("user_courses").insert(ids.map((offering_id) => ({ user_id: account.id, offering_id })))
    : { error: null };
  if (added.error) {
    // Put back what was there, so a failure does not leave the student without courses.
    if (previous.length) {
      await supabase.from("user_courses").insert(previous.map((offering_id) => ({ user_id: account.id, offering_id })));
    }
    return { error: "No pudimos guardar tu cursada." };
  }
  // The map: taking these subjects now.
  const statuses = await supabase
    .from("user_subjects")
    .select("subject_id, status")
    .eq("user_id", account.id)
    .in("subject_id", [...subjectIds, ...dropped]);
  if (statuses.error) return { error: "Guardamos tu cursada, pero no pudimos actualizar tu mapa." };
  const statusOf = new Map(statuses.data.map((r) => [r.subject_id as number, r.status as string]));
  const toMark = subjectIds.filter((id) => !statusOf.has(id));
  const toClear = dropped.filter((id) => statusOf.get(id) === "in_progress");
  if (toMark.length) {
    const marked = await supabase
      .from("user_subjects")
      .insert(toMark.map((subject_id) => ({ user_id: account.id, subject_id, status: "in_progress", grade: null })));
    if (marked.error) return { error: "Guardamos tu cursada, pero no pudimos actualizar tu mapa." };
  }
  if (toClear.length) {
    const cleared = await supabase
      .from("user_subjects")
      .delete()
      .eq("user_id", account.id)
      .eq("status", "in_progress")
      .in("subject_id", toClear);
    if (cleared.error) return { error: "Guardamos tu cursada, pero no pudimos actualizar tu mapa." };
  }

  revalidatePath("/");
  revalidatePath("/mapa");
  return { error: null };
}

export type SubmitOfferState = { error: string | null; message: string | null };

// "Enviar" la oferta del SIU cuando el plan del alumno no tiene la del cuatrimestre actual.
// Se interpreta acá mismo con el intérprete del administrador (para avisar al instante si el
// texto no sirve) y se guarda pendiente: la publica un administrador desde /admin. La base
// controla que sea su plan y el cuatrimestre actual, y que no tenga más de 3 pendientes.
export async function submitOffer(_prev: SubmitOfferState, formData: FormData): Promise<SubmitOfferState> {
  const account = await requireProfile();
  const planId = account.planId!;
  const text = String(formData.get("text") ?? "");
  const tooLong = offerTextProblem(text);
  if (tooLong) return { error: tooLong, message: null };

  const supabase = await createClient();
  const term = await supabase.from("terms").select("id, year, half").eq("is_current", true).maybeSingle();
  if (term.error || !term.data) return { error: "No hay un cuatrimestre abierto.", message: null };
  const offer = await supabase.from("offerings").select("id").eq("term_id", term.data.id).eq("plan_id", planId).eq("visible", true).limit(1);
  if (offer.error) return { error: "No pudimos revisar la oferta de tu plan.", message: null };
  if (offer.data.length) return { error: submissionRefusal("already_published"), message: null };

  const { subjects, knownCodes } = await getPlanCatalog(planId);
  const { preview } = previewImport(text, subjects, knownCodes);
  const problem = offerPreviewProblem(preview, { year: term.data.year as number, half: term.data.half as 1 | 2 });
  if (problem) return { error: problem, message: null };

  const saved = await supabase.from("offer_submissions").insert({
    term_id: term.data.id,
    plan_id: planId,
    raw_text: text,
    subjects: preview.stats.subjects,
    courses: preview.stats.courses,
    blocks: preview.stats.blocks,
  });
  if (saved.error) {
    if (NOT_YET.has(saved.error.code)) return { error: "Todavía no se puede mandar la oferta desde acá.", message: null };
    return { error: submissionRefusal(saved.error.hint), message: null };
  }
  revalidatePath("/plan");
  return { error: null, message: `${submissionSummary(preview.stats)} Gracias: la revisamos y en breve todos los de tu plan van a poder armar su cuatrimestre.` };
}
