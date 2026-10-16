"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, termLabel } from "@/lib/admin/data";
import { commissionKey, leadOf, previewImport, sameLead, termFromPeriodo, type OfferingDraft } from "@/lib/admin/offer-import";

// Writes of the admin screen. Every action checks that the caller is an admin, and the
// database checks it again (RLS): only admins write terms, offer and imports.

export type ActionState = { error: string | null };

const ok: ActionState = { error: null };

async function currentTerm() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("terms").select("id, year, half").eq("is_current", true).maybeSingle();
  if (error) throw new Error(`terms: ${error.message}`);
  return data as { id: string; year: number; half: 1 | 2 } | null;
}

/** Creates the term (if new) and makes it the current one. */
export async function setCurrentTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const year = Number(formData.get("year"));
  const half = Number(formData.get("half"));
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || (half !== 1 && half !== 2)) {
    return { error: "Elegí un año y un cuatrimestre válidos." };
  }
  const id = `${year}-${half}C`;
  const supabase = await createClient();
  const created = await supabase.from("terms").upsert({ id, year, half }, { onConflict: "id", ignoreDuplicates: true });
  if (created.error) return { error: "No pudimos crear el cuatrimestre." };
  // Only one current term: unset the others first (unique index).
  const unset = await supabase.from("terms").update({ is_current: false }).eq("is_current", true).neq("id", id);
  if (unset.error) return { error: "No pudimos cambiar el cuatrimestre actual." };
  const set = await supabase.from("terms").update({ is_current: true }).eq("id", id);
  if (set.error) return { error: "No pudimos cambiar el cuatrimestre actual." };
  revalidatePath("/admin");
  return ok;
}

export async function setReviewsDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const date = String(formData.get("date") ?? "");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "La fecha no es válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("terms").update({ reviews_open_on: date || null }).eq("id", term.id);
  if (error) return { error: "No pudimos guardar la fecha." };
  revalidatePath("/admin");
  return ok;
}

/** Subjects of the plan and the SIU codes already known for them. */
async function planCatalog(planId: string) {
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

/** "Procesar": reads the pasted text and saves it with its summary, without publishing. */
export async function processOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const text = String(formData.get("text") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  if (!text.trim()) return { error: "Pegá el texto de la página de horarios del SIU." };

  const { subjects, knownCodes } = await planCatalog(planId);
  if (subjects.length === 0) return { error: "No encontramos ese plan." };
  const { preview } = previewImport(text, subjects, knownCodes);
  if (!preview.format) {
    return { error: "No reconocemos el texto. Copiá la página de horarios del SIU completa (Ctrl+A, Ctrl+C) y pegala acá." };
  }
  const fromText = termFromPeriodo(preview.periodo);
  if (fromText && (fromText.year !== term.year || fromText.half !== term.half)) {
    return { error: `El texto es del ${termLabel(fromText)} y el cuatrimestre actual es el ${termLabel(term)}.` };
  }
  if (preview.stats.subjects === 0) {
    return { error: "Ninguna materia del texto es de este plan. ¿Elegiste la carrera correcta en el SIU?" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("offer_imports")
    .upsert({ term_id: term.id, plan_id: planId, status: "processed", raw_text: text, parsed: preview, published_at: null });
  if (error) return { error: "No pudimos guardar el texto procesado." };
  revalidatePath("/admin");
  return ok;
}

/** "Descartar": forgets a processed text that was not published. */
export async function discardOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("offer_imports")
    .delete()
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .eq("status", "processed");
  if (error) return { error: "No pudimos descartar el texto." };
  revalidatePath("/admin");
  return ok;
}

type ExistingOffering = {
  course_id: number;
  term_id: string;
  siu_subject_code: string;
  course_number: string | null;
  label: string;
  teachers: { nombre: string }[] | null;
};

/**
 * Course (identity across terms and plans) of each commission. The same commission
 * published this term for another plan keeps its course; one from an earlier term keeps it
 * when the number and the lead teacher are the same. Everything else is a new course.
 */
async function courseIds(termId: string, drafts: OfferingDraft[]): Promise<Map<string, number>> {
  const supabase = await createClient();
  const codes = [...new Set(drafts.map((d) => d.siu_subject_code))];
  const { data, error } = await supabase
    .from("offerings")
    .select("course_id, term_id, siu_subject_code, course_number, label, teachers")
    .in("siu_subject_code", codes)
    .order("term_id", { ascending: false });
  if (error) throw new Error(`offerings: ${error.message}`);
  const existing = data as ExistingOffering[];

  const ids = new Map<string, number>();
  const missing: { key: string; siuCode: string }[] = [];
  for (const d of drafts) {
    const key = commissionKey(d);
    if (ids.has(key) || missing.some((m) => m.key === key)) continue;
    const same = existing.filter((e) => commissionKey(e) === key);
    const found =
      same.find((e) => e.term_id === termId) ??
      same.find((e) => e.term_id < termId && sameLead(leadOf(e.teachers), leadOf(d.teachers)));
    if (found) ids.set(key, found.course_id);
    else missing.push({ key, siuCode: d.siu_subject_code });
  }

  if (missing.length) {
    const created = await supabase
      .from("courses")
      .insert(missing.map((m) => ({ siu_subject_code: m.siuCode })))
      .select("id");
    if (created.error) throw new Error(`courses: ${created.error.message}`);
    // PostgREST returns the inserted rows in the order they were sent.
    created.data.forEach((row, i) => ids.set(missing[i].key, row.id as number));
  }
  return ids;
}

/** "Publicar": writes the offer of the plan; from then on students see it. */
export async function publishOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const supabase = await createClient();

  const imp = await supabase
    .from("offer_imports")
    .select("status, raw_text")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (imp.error || !imp.data) return { error: "Primero procesá el texto del SIU." };
  if (imp.data.status === "published") return { error: "Esta oferta ya está publicada." };

  const already = await supabase
    .from("offerings")
    .select("id", { count: "exact", head: true })
    .eq("term_id", term.id)
    .eq("plan_id", planId);
  if (already.error) return { error: "No pudimos revisar la oferta actual." };
  if ((already.count ?? 0) > 0) return { error: "Este plan ya tiene oferta cargada para el cuatrimestre." };

  const { subjects, knownCodes } = await planCatalog(planId);
  const { preview, drafts } = previewImport(imp.data.raw_text as string, subjects, knownCodes);
  if (drafts.length === 0) return { error: "El texto no tiene cursos de este plan." };

  try {
    // Remember which SIU code is which subject, for the next terms.
    const codes = await supabase
      .from("subject_siu_codes")
      .upsert(preview.matched.map((m) => ({ subject_id: m.subjectId, siu_code: m.siuCode })), { ignoreDuplicates: true });
    if (codes.error) throw new Error(`subject_siu_codes: ${codes.error.message}`);

    const courseOf = await courseIds(term.id, drafts);
    const offerings = await supabase
      .from("offerings")
      .insert(
        drafts.map((d) => ({
          term_id: term.id,
          plan_id: planId,
          course_id: courseOf.get(commissionKey(d))!,
          siu_subject_code: d.siu_subject_code,
          siu_subject_name: d.siu_subject_name,
          course_number: d.course_number,
          practice: d.practice,
          label: d.label,
          modality: d.modality,
          teachers: d.teachers,
          quota: d.quota,
          enrolled: d.enrolled,
        })),
      )
      .select("id");
    if (offerings.error) throw new Error(`offerings: ${offerings.error.message}`);

    const blocks = offerings.data.flatMap((row, i) => drafts[i].blocks.map((b) => ({ ...b, offering_id: row.id as number })));
    if (blocks.length) {
      const inserted = await supabase.from("offering_blocks").insert(blocks);
      if (inserted.error) throw new Error(`offering_blocks: ${inserted.error.message}`);
    }

    const done = await supabase
      .from("offer_imports")
      .update({ status: "published", parsed: preview, published_at: new Date().toISOString() })
      .eq("term_id", term.id)
      .eq("plan_id", planId);
    if (done.error) throw new Error(`offer_imports: ${done.error.message}`);
  } catch (e) {
    // Leave no half-published offer behind (blocks go with their offerings).
    await supabase.from("offerings").delete().eq("term_id", term.id).eq("plan_id", planId);
    console.error("publishOffer", e);
    return { error: "No pudimos publicar la oferta. No quedó nada a medias: probá de nuevo." };
  }

  revalidatePath("/admin");
  return ok;
}
