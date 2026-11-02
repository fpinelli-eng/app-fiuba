"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/data";
import { examPreviewRows, examRows, examStats, planMismatch, type ExamPreview } from "@/lib/admin/exams";
import { parseSiuExams, type ExamParseResult } from "@/lib/siu/exams";
import { fetchSiuExamsPage, isLink, siuExamsUrl } from "@/lib/siu/exams-fetch";
import { parseSiuExamsHtml } from "@/lib/siu/exams-html";

// "Fechas de examen" in Administración: process (summary, nothing saved) and publish
// (replaces the plan's exam tables). The database only lets admins write them.
// The admin pastes the link of the SIU search (the server downloads the page, with times,
// rooms and teachers) or the copied text of the page (only dates).

export type ExamState = { error: string | null; preview: ExamPreview | null; published: boolean };

async function planInfo(planId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("year, careers(name)").eq("id", planId).maybeSingle();
  if (!data) return null;
  const c = data.careers as unknown as { name: string } | { name: string }[] | null;
  return { year: data.year as number, career: (Array.isArray(c) ? c[0]?.name : c?.name) ?? "" };
}

type Read = { error: string } | { parsed: ExamParseResult; preview: ExamPreview };

async function read(input: string, plan: { year: number; career: string }): Promise<Read> {
  let parsed: ExamParseResult;
  const source = isLink(input) ? "link" : "text";
  if (source === "link") {
    const checked = siuExamsUrl(input);
    if ("error" in checked) return checked;
    const page = await fetchSiuExamsPage(checked.url);
    if ("error" in page) return page;
    parsed = parseSiuExamsHtml(page.html);
  } else {
    parsed = parseSiuExams(input);
  }
  const preview: ExamPreview = {
    stats: examStats(parsed),
    warnings: parsed.warnings,
    mismatch: planMismatch(parsed, plan.career, plan.year),
    source,
    rows: examPreviewRows(parsed),
  };
  return { parsed, preview };
}

const NOTHING_FOUND = {
  link: "No encontramos mesas en esa búsqueda. En el SIU elegí carrera y plan, tocá Buscar y copiá el enlace de la barra de direcciones.",
  text: "No encontramos mesas en el texto. Pegá el enlace de la búsqueda del SIU, o copiá la página \"Fechas de examen\" completa (Ctrl+A, Ctrl+C) después de Buscar.",
};

export async function previewExams(_prev: ExamState, formData: FormData): Promise<ExamState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const text = String(formData.get("text") ?? "");
  const plan = await planInfo(planId);
  if (!plan) return { error: "No encontramos ese plan.", preview: null, published: false };
  const result = await read(text, plan);
  if ("error" in result) return { error: result.error, preview: null, published: false };
  const { preview } = result;
  if (preview.stats.tables === 0) return { error: NOTHING_FOUND[preview.source], preview: null, published: false };
  return { error: null, preview, published: false };
}

export async function publishExams(_prev: ExamState, formData: FormData): Promise<ExamState> {
  await requireAdmin();
  const planId = String(formData.get("planId") ?? "");
  const text = String(formData.get("text") ?? "");
  const plan = await planInfo(planId);
  if (!plan) return { error: "No encontramos ese plan.", preview: null, published: false };
  const result = await read(text, plan);
  if ("error" in result) return { error: result.error, preview: null, published: false };
  const { parsed, preview } = result;
  const rows = examRows(parsed, planId);
  if (rows.length === 0) return { error: NOTHING_FOUND[preview.source], preview: null, published: false };

  const supabase = await createClient();
  // The plan's exam dates are replaced as a whole: nothing points to these rows.
  const removed = await supabase.from("exam_tables").delete().eq("plan_id", planId);
  if (removed.error) return { error: "No pudimos reemplazar las fechas.", preview, published: false };
  const added = await supabase.from("exam_tables").insert(rows);
  if (added.error) return { error: "No pudimos guardar las fechas. El plan quedó sin fechas: publicá de nuevo.", preview, published: false };
  const saved = await supabase
    .from("exam_imports")
    .upsert({ plan_id: planId, stats: preview.stats, published_at: new Date().toISOString() });
  if (saved.error) return { error: "Guardamos las fechas, pero no la fecha de carga.", preview, published: true };

  revalidatePath("/admin/examenes");
  return { error: null, preview, published: true };
}
