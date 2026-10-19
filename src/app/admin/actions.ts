"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, termLabel } from "@/lib/admin/data";
import {
  commissionKey,
  leadOf,
  offeringKey,
  previewImport,
  sameLead,
  termFromPeriodo,
  type ImportPreview,
  type OfferingDraft,
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
  revalidatePath("/admin");
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

  const { subjects } = await planCatalog(planId);
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

  const { knownCodes } = await planCatalog(planId);
  const { preview } = previewImport(imp.data.raw_text as string, subjects, knownCodes);
  const replacing = (imp.data.parsed as ImportPreview | null)?.replacing;
  const saved = await supabase
    .from("offer_imports")
    .update({ parsed: replacing ? { ...preview, replacing } : preview })
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
  const supabase = await createClient();

  const imp = await supabase
    .from("offer_imports")
    .select("status, raw_text")
    .eq("term_id", term.id)
    .eq("plan_id", planId)
    .maybeSingle();
  if (imp.error || !imp.data) return { error: "Primero procesá el texto del SIU." };
  if (imp.data.status === "published") return { error: "Esta oferta ya está publicada." };

  const existingRows = await supabase
    .from("offerings")
    .select("id, siu_subject_code, course_number, practice")
    .eq("term_id", term.id)
    .eq("plan_id", planId);
  if (existingRows.error) return { error: "No pudimos revisar la oferta actual." };
  const existing = new Map((existingRows.data as OfferingRow[]).map((o) => [offeringKey(o), o.id]));
  const replacing = existing.size > 0;

  const { subjects, knownCodes } = await planCatalog(planId);
  const { preview, drafts } = previewImport(imp.data.raw_text as string, subjects, knownCodes);
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
      const courseOf = await courseIds(term.id, toInsert);
      const inserted = await supabase
        .from("offerings")
        .insert(
          toInsert.map((d) => ({
            term_id: term.id,
            plan_id: planId,
            course_id: courseOf.get(commissionKey(d))!,
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
