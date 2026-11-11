"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlanCatalog } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/admin/data";
import { offerPreviewProblem, offerTextProblem } from "@/lib/offer/check";
import {
  commissionKey,
  decisionFor,
  detectCourseChanges,
  leadOf,
  offeringKey,
  previewImport,
  sameLead,
  type CourseDecision,
  type ImportPreview,
  type OfferingDraft,
  type PreviousOffering,
} from "@/lib/admin/offer-import";

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

/** Commissions of these subjects published in earlier terms (any plan), for "Cursos con cambios". */
async function previousOfferings(codes: string[], termId: string): Promise<PreviousOffering[]> {
  if (!codes.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offerings")
    .select("course_id, term_id, siu_subject_code, course_number, label, teachers")
    .in("siu_subject_code", codes)
    .lt("term_id", termId);
  if (error) throw new Error(`offerings: ${error.message}`);
  return data.map((o) => ({
    courseId: o.course_id as number,
    termId: o.term_id as string,
    siuCode: o.siu_subject_code as string,
    courseNumber: (o.course_number as string | null) ?? null,
    label: o.label as string,
    teachers: (o.teachers as { nombre: string }[] | null) ?? null,
  }));
}

/** The summary of a pasted text for a plan, with the courses that changed since the previous term. */
async function buildPreview(text: string, planId: string, termId: string) {
  const { subjects, knownCodes } = await getPlanCatalog(planId);
  const { preview, drafts } = previewImport(text, subjects, knownCodes);
  const previous = await previousOfferings([...new Set(drafts.map((d) => d.siu_subject_code))], termId);
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const changes = detectCourseChanges(drafts, previous, termId, names);
  return { preview: changes.length ? { ...preview, changes } : preview, drafts, subjects };
}

/** "Procesar": reads the pasted text and saves it with its summary, without publishing. */
export async function processOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const text = String(formData.get("text") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const result = await processText(planId, text, term);
  if (!result.error) revalidatePath("/admin");
  return result;
}

/** The core of "Procesar", also used for an offer sent by a student ("Procesar y publicar"). */
async function processText(planId: string, text: string, term: { id: string; year: number; half: 1 | 2 }): Promise<ActionState> {
  if (!text.trim()) return { error: "Pegá el texto de la página de horarios del SIU." };
  const tooLong = offerTextProblem(text);
  if (tooLong) return { error: tooLong };

  const { preview, subjects } = await buildPreview(text, planId, term.id);
  if (subjects.length === 0) return { error: "No encontramos ese plan." };
  const problem = offerPreviewProblem(preview, term);
  if (problem) return { error: problem };

  const supabase = await createClient();
  // Replacing a published offer: keep it, so "Descartar" can bring it back.
  const current = await supabase
    .from("offer_imports")
    .select("status, raw_text, parsed, published_at")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (current.error) return { error: "No pudimos revisar la oferta actual." };
  const previous = current.data?.parsed as ImportPreview | undefined;
  const replacing =
    current.data?.status === "published"
      ? { rawText: current.data.raw_text as string, preview: previous!, publishedAt: (current.data.published_at as string | null) ?? null }
      : previous?.replacing;

  const { error } = await supabase.from("offer_imports").upsert({
    term_id: term.id,
    plan_id: planId,
    status: "processed",
    raw_text: text,
    parsed: replacing ? { ...preview, replacing } : preview,
    published_at: null,
  });
  if (error) return { error: "No pudimos guardar el texto procesado." };
  return ok;
}

/**
 * Emparejar a mano: a SIU subject that did not match by name ("ADM. Y CONTROL DE PROY.
 * INFORMATICOS I") is a subject of the plan. Saved in subject_siu_codes, so the next terms
 * recognize it alone, and the processed summary is recalculated.
 */
export async function linkSiuSubject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const siuCode = String(formData.get("siuCode") ?? "").trim();
  const subjectId = Number(formData.get("subjectId"));
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  if (!/^[A-Z0-9]+$/.test(siuCode) || !Number.isInteger(subjectId) || subjectId <= 0) {
    return { error: "Elegí la materia del plan." };
  }

  const { subjects } = await getPlanCatalog(planId);
  if (!subjects.some((s) => s.id === subjectId)) return { error: "Esa materia no es de este plan." };

  const supabase = await createClient();
  const imp = await supabase
    .from("offer_imports")
    .select("status, raw_text, parsed")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (imp.error || !imp.data || imp.data.status !== "processed") {
    return { error: "Emparejá antes de publicar: procesá el texto (o reemplazalo) y emparejá ahí." };
  }

  const linked = await supabase
    .from("subject_siu_codes")
    .upsert({ subject_id: subjectId, siu_code: siuCode }, { ignoreDuplicates: true });
  if (linked.error) return { error: "No pudimos guardar el emparejamiento." };

  const { preview } = await buildPreview(imp.data.raw_text as string, planId, term.id);
  const old = imp.data.parsed as ImportPreview | null;
  const keys = new Set((preview.changes ?? []).map((c) => c.key));
  const decisions = Object.fromEntries(Object.entries(old?.decisions ?? {}).filter(([k]) => keys.has(k)));
  const parsed: ImportPreview = { ...preview };
  if (old?.replacing) parsed.replacing = old.replacing;
  if (Object.keys(decisions).length) parsed.decisions = decisions;
  const saved = await supabase
    .from("offer_imports")
    .update({ parsed })
    .eq("term_id", term.id)
    .eq("plan_id", planId);
  if (saved.error) return { error: "Guardamos el emparejamiento, pero no pudimos actualizar el resumen." };
  revalidatePath("/admin");
  return ok;
}

/** "Descartar": forgets a processed text that was not published (and brings back the offer it was replacing). */
export async function discardOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const supabase = await createClient();
  const current = await supabase
    .from("offer_imports")
    .select("status, parsed")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (current.error) return { error: "No pudimos descartar el texto." };
  const replacing = (current.data?.parsed as ImportPreview | undefined)?.replacing;
  if (current.data?.status === "processed" && replacing) {
    const restored = await supabase
      .from("offer_imports")
      .update({ status: "published", raw_text: replacing.rawText, parsed: replacing.preview, published_at: replacing.publishedAt })
      .eq("term_id", term.id)
      .eq("plan_id", planId);
    if (restored.error) return { error: "No pudimos descartar el texto." };
    revalidatePath("/admin");
    return ok;
  }
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
async function courseIds(termId: string, drafts: OfferingDraft[], preview: ImportPreview): Promise<Map<string, number>> {
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
    const thisTerm = same.find((e) => e.term_id === termId);
    if (thisTerm) {
      ids.set(key, thisTerm.course_id);
      continue;
    }
    // "Cursos con cambios": what the admin chose, or else the suggestion.
    const decision = decisionFor(preview, key);
    if (decision?.kind === "same") ids.set(key, decision.courseId);
    else if (decision) missing.push({ key, siuCode: d.siu_subject_code });
    else {
      const found = same.find((e) => e.term_id < termId && sameLead(leadOf(e.teachers), leadOf(d.teachers)));
      if (found) ids.set(key, found.course_id);
      else missing.push({ key, siuCode: d.siu_subject_code });
    }
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

type OfferingRow = { id: number; siu_subject_code: string; course_number: string | null; practice: string | null };

/** In batches, so a replaced offer does not send hundreds of requests at once. */
async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run));
}

/**
 * "Publicar": writes the offer of the plan; from then on students see it.
 * When the plan already has an offer ("Reemplazar con otro texto"), it never deletes it:
 * courses that are still there are updated in place (so plans A/B, courses taken and
 * reviews keep pointing to them), new ones are added and missing ones are hidden.
 */
export async function publishOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const result = await publishPlan(planId, term);
  if (!result.error) {
    await closeSubmissions(term.id, planId, null);
    revalidatePath("/admin");
  }
  return result;
}

/** The core of "Publicar": publishes the processed import of the plan. */
async function publishPlan(planId: string, term: { id: string }): Promise<ActionState> {
  const supabase = await createClient();

  const imp = await supabase
    .from("offer_imports")
    .select("status, raw_text, parsed")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (imp.error || !imp.data) return { error: "Primero procesá el texto del SIU." };
  if (imp.data.status === "published") return { error: "Esta oferta ya está publicada." };
  const decisions = (imp.data.parsed as ImportPreview | null)?.decisions;

  const existingRows = await supabase
    .from("offerings")
    .select("id, siu_subject_code, course_number, practice")
    .eq("term_id", term.id)
    .eq("plan_id", planId);
  if (existingRows.error) return { error: "No pudimos revisar la oferta actual." };
  const existing = new Map((existingRows.data as OfferingRow[]).map((o) => [offeringKey(o), o.id]));
  const replacing = existing.size > 0;

  const built = await buildPreview(imp.data.raw_text as string, planId, term.id);
  const preview: ImportPreview = decisions ? { ...built.preview, decisions } : built.preview;
  const drafts = built.drafts;
  if (drafts.length === 0) return { error: "El texto no tiene cursos de este plan." };

  const fields = (d: OfferingDraft) => ({
    siu_subject_name: d.siu_subject_name,
    label: d.label,
    modality: d.modality,
    teachers: d.teachers,
    quota: d.quota,
    enrolled: d.enrolled,
  });
  const toUpdate = drafts.filter((d) => existing.has(offeringKey(d)));
  const toInsert = drafts.filter((d) => !existing.has(offeringKey(d)));
  const draftKeys = new Set(drafts.map(offeringKey));
  const toHide = [...existing.entries()].filter(([key]) => !draftKeys.has(key)).map(([, id]) => id);

  try {
    // Remember which SIU code is which subject, for the next terms.
    const codes = await supabase
      .from("subject_siu_codes")
      .upsert(preview.matched.map((m) => ({ subject_id: m.subjectId, siu_code: m.siuCode })), { ignoreDuplicates: true });
    if (codes.error) throw new Error(`subject_siu_codes: ${codes.error.message}`);

    // New rows (the whole offer the first time).
    const offeringIdOf = new Map<string, number>();
    if (toInsert.length) {
      const courseOf = await courseIds(term.id, toInsert, preview);
      const inserted = await supabase
        .from("offerings")
        .insert(
          toInsert.map((d) => ({
            term_id: term.id,
            plan_id: planId,
            course_id: courseOf.get(commissionKey(d))!,
            visible: decisionFor(preview, commissionKey(d))?.kind !== "hide",
            siu_subject_code: d.siu_subject_code,
            course_number: d.course_number,
            practice: d.practice,
            ...fields(d),
          })),
        )
        .select("id");
      if (inserted.error) throw new Error(`offerings: ${inserted.error.message}`);
      inserted.data.forEach((row, i) => offeringIdOf.set(offeringKey(toInsert[i]), row.id as number));
    }

    // Rows that are still there: same id and course, new data. They keep their visibility (an admin may have hidden them).
    await inBatches(toUpdate, 10, async (d) => {
      const id = existing.get(offeringKey(d))!;
      const updated = await supabase.from("offerings").update(fields(d)).eq("id", id);
      if (updated.error) throw new Error(`offerings: ${updated.error.message}`);
      offeringIdOf.set(offeringKey(d), id);
    });

    // Schedules: replaced for the updated rows, written for the new ones.
    const updatedIds = toUpdate.map((d) => existing.get(offeringKey(d))!);
    if (updatedIds.length) {
      const removed = await supabase.from("offering_blocks").delete().in("offering_id", updatedIds);
      if (removed.error) throw new Error(`offering_blocks: ${removed.error.message}`);
    }
    const blocks = drafts.flatMap((d) => d.blocks.map((b) => ({ ...b, offering_id: offeringIdOf.get(offeringKey(d))! })));
    if (blocks.length) {
      const inserted = await supabase.from("offering_blocks").insert(blocks);
      if (inserted.error) throw new Error(`offering_blocks: ${inserted.error.message}`);
    }

    // Courses no longer in the SIU text: hidden, never deleted.
    if (toHide.length) {
      const hidden = await supabase.from("offerings").update({ visible: false }).in("id", toHide);
      if (hidden.error) throw new Error(`offerings: ${hidden.error.message}`);
    }

    const done = await supabase
      .from("offer_imports")
      .update({ status: "published", parsed: preview, published_at: new Date().toISOString() })
      .eq("term_id", term.id)
      .eq("plan_id", planId);
    if (done.error) throw new Error(`offer_imports: ${done.error.message}`);
  } catch (e) {
    console.error("publishOffer", e);
    if (!replacing) {
      // First publication: leave no half-published offer behind (blocks go with their offerings).
      await supabase.from("offerings").delete().eq("term_id", term.id).eq("plan_id", planId);
      return { error: "No pudimos publicar la oferta. No quedó nada a medias: probá de nuevo." };
    }
    return { error: "No pudimos publicar todos los cambios. Probá de nuevo: lo que ya se actualizó queda bien." };
  }

  return ok;
}

// Offer sent by students ---------------------------------------------------------------

// Undefined table or function: the migration 20261112120000_offer_submissions is not applied yet
// (Vercel previews use the production database, which only gets it when the branch is merged).
const NOT_YET = new Set(["42P01", "42883", "PGRST205", "PGRST202"]);

/**
 * Once the plan's offer is published, its pending submissions are done: the one that was used is
 * "published" and the rest "rejected" (their authors no longer see them: the plan has its offer).
 */
async function closeSubmissions(termId: string, planId: string, usedId: number | null) {
  const supabase = await createClient();
  const { id: reviewer } = await requireAdmin();
  const reviewed = { reviewed_at: new Date().toISOString(), reviewed_by: reviewer };
  if (usedId !== null) {
    const used = await supabase.from("offer_submissions").update({ status: "published", ...reviewed }).eq("id", usedId).eq("status", "pending");
    if (used.error && !NOT_YET.has(used.error.code)) console.error("offer_submissions", used.error.message);
  }
  const rest = await supabase
    .from("offer_submissions")
    .update({ status: "rejected", ...reviewed })
    .eq("term_id", termId)
    .eq("plan_id", planId)
    .eq("status", "pending");
  if (rest.error && !NOT_YET.has(rest.error.code)) console.error("offer_submissions", rest.error.message);
}

async function pendingSubmission(formData: FormData) {
  const id = Number(formData.get("submissionId"));
  if (!Number.isInteger(id) || id <= 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_submissions")
    .select("id, term_id, plan_id, raw_text, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.status !== "pending") return null;
  return { id: data.id as number, termId: data.term_id as string, planId: data.plan_id as string, rawText: data.raw_text as string };
}

/**
 * "Procesar y publicar" an offer sent by a student: the same "Procesar" and "Publicar" of the
 * admin import, with the student's text, for their plan and the current term.
 */
export async function publishSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const submission = await pendingSubmission(formData);
  if (!submission) return { error: "Esa oferta ya no está pendiente." };
  if (submission.termId !== term.id) return { error: "Esa oferta es de otro cuatrimestre: rechazala." };

  const supabase = await createClient();
  const current = await supabase
    .from("offer_imports")
    .select("status")
    .eq("term_id", term.id)
    .eq("plan_id", submission.planId)
    .maybeSingle();
  if (current.error) return { error: "No pudimos revisar la oferta actual." };
  if (current.data?.status === "published") {
    return { error: "Este plan ya tiene la oferta publicada. Para cambiarla, usá «Reemplazar con otro texto»." };
  }
  if (current.data?.status === "processed") {
    return { error: "Este plan tiene un texto procesado sin publicar: publicalo o descartalo primero." };
  }

  const processed = await processText(submission.planId, submission.rawText, term);
  if (processed.error) return processed;
  const published = await publishPlan(submission.planId, term);
  revalidatePath("/admin");
  if (published.error) return { error: `Quedó procesada, pero no se publicó: ${published.error}` };
  await closeSubmissions(term.id, submission.planId, submission.id);
  revalidatePath("/admin");
  revalidatePath("/plan");
  return ok;
}

/** "Rechazar" an offer sent by a student. Its author sees it and can send another. */
export async function rejectSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { id: reviewer } = await requireAdmin();
  const submission = await pendingSubmission(formData);
  if (!submission) return { error: "Esa oferta ya no está pendiente." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("offer_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewer })
    .eq("id", submission.id)
    .eq("status", "pending");
  if (error) return { error: "No pudimos rechazarla." };
  revalidatePath("/admin");
  return ok;
}

/** "Quitar" / "Volver a mostrar" a course of the published offer. Students never see hidden ones. */
export async function setOfferingVisible(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = Number(formData.get("offeringId"));
  const visible = formData.get("visible") === "true";
  if (!Number.isInteger(id) || id <= 0) return { error: "Curso inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("offerings").update({ visible }).eq("id", id);
  if (error) return { error: "No pudimos cambiar el curso." };
  revalidatePath("/admin");
  return ok;
}

/** "Cursos con cambios": same course as an earlier one, new course, or new and hidden. */
export async function setCourseDecision(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const key = String(formData.get("key") ?? "");
  const choice = String(formData.get("decision") ?? "");
  const term = await currentTerm();
  if (!term) return { error: "Primero elegí el cuatrimestre." };
  const supabase = await createClient();
  const imp = await supabase
    .from("offer_imports")
    .select("status, parsed")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (imp.error || !imp.data || imp.data.status !== "processed") return { error: "Primero procesá el texto del SIU." };
  const parsed = imp.data.parsed as ImportPreview;
  const change = parsed.changes?.find((c) => c.key === key);
  if (!change) return { error: "Ese curso ya no está en la lista." };

  let decision: CourseDecision;
  if (choice === "new" || choice === "hide") decision = { kind: choice };
  else {
    const courseId = Number(choice.replace(/^same:/, ""));
    if (!change.candidates.some((c) => c.courseId === courseId)) return { error: "Elegí un curso de la lista." };
    decision = { kind: "same", courseId };
  }
  const { error } = await supabase
    .from("offer_imports")
    .update({ parsed: { ...parsed, decisions: { ...parsed.decisions, [key]: decision } } })
    .eq("term_id", term.id)
    .eq("plan_id", planId);
  if (error) return { error: "No pudimos guardar la elección." };
  revalidatePath("/admin");
  return ok;
}
