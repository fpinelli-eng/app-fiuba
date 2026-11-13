import { NextResponse } from "next/server";
import { getMapData } from "@/lib/map/data";
import { titleCase } from "@/lib/plan/format";
import { getMyReviews, termLabel } from "@/lib/reviews/mine";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

type OfferingRef = { term_id: string; siu_subject_code: string; siu_subject_name: string; label: string } | null;

// Un curso de la oferta, legible: { cuatrimestre: "1C 2026", codigo, materia, curso: "Curso 3" }.
function course(o: OfferingRef) {
  return {
    cuatrimestre: o ? termLabel(o.term_id) : null,
    codigo: o?.siu_subject_code ?? null,
    materia: o?.siu_subject_name ? titleCase(o.siu_subject_name) : null,
    curso: o?.label ?? null,
  };
}

const OFFER_STATUS: Record<string, string> = { pending: "pendiente", published: "publicada", rejected: "rechazada" };

// "Descargar mis datos": todo lo que la app guarda del alumno, en un archivo JSON (Ley 25.326,
// derecho de acceso). Si se agrega una tabla o columna con datos del alumno, se suma acá.
export async function GET() {
  const account = await requireProfile();
  const supabase = await createClient();
  const offering = "offerings(term_id, siu_subject_code, siu_subject_name, label)";
  const [map, reviews, profile, courses, choices, submissions, reminders] = await Promise.all([
    getMapData(account.id, account.planId!),
    getMyReviews(),
    supabase.from("profiles").select("created_at, intro_seen_at").eq("id", account.id).single(),
    supabase.from("user_courses").select(`created_at, ${offering}`).eq("user_id", account.id),
    supabase.from("plan_choices").select(`option, created_at, ${offering}`).eq("user_id", account.id).order("option"),
    // Las ofertas del SIU que pegó en el Plan, con el texto tal cual lo mandó: es lo que se guarda.
    supabase
      .from("offer_submissions")
      .select("created_at, term_id, plan_id, status, reviewed_at, subjects, courses, blocks, raw_text")
      .eq("submitted_by", account.id)
      .order("created_at"),
    supabase
      .from("exam_reminders")
      .select("subject_name, table_name, kind, exam_date, start_time, enroll_from, enroll_to, created_at, first_sent_at, last_sent_at")
      .eq("user_id", account.id),
  ]);
  const failed = [profile, courses, choices, submissions].find((r) => r.error);
  // Aparte y sin cortar si falla: la columna llega con la migración 20261115120000_signup_source, que las
  // vistas previas (base de producción) no tienen hasta integrar la rama.
  const source = await supabase.from("profiles").select("signup_source").eq("id", account.id).maybeSingle();
  // Igual: llegan con la migración 20261116130000_recordarme_confirmacion.
  const [reminderEmail, confirmations] = await Promise.all([
    supabase.from("profiles").select("reminder_email").eq("id", account.id).maybeSingle(),
    supabase.from("reminder_confirmations").select("email, sent_at").eq("user_id", account.id).order("sent_at"),
  ]);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const byId = new Map(map.subjects.map((s) => [s.id, s]));
  const data = {
    descargado: new Date().toISOString(),
    cuenta: {
      mail: account.email,
      nombre: account.fullName,
      administrador: account.isAdmin,
      alta: profile.data!.created_at,
      vio_las_historias: profile.data!.intro_seen_at ?? null,
      llego_por_el_qr: source.error ? null : source.data?.signup_source === "qr",
    },
    carrera: { carrera: map.careerName, plan: map.year, plan_id: map.planId },
    materias: map.progress.subjects.map((s) => ({
      codigo: byId.get(s.subjectId)?.code ?? null,
      materia: byId.get(s.subjectId)?.name ?? null,
      estado: { approved: "aprobada", final_pending: "final pendiente", in_progress: "cursando" }[s.status],
      nota: s.grade,
    })),
    requisitos_aprobados: map.requirements.filter((r) => map.progress.requirements.includes(r.id)).map((r) => r.name),
    creditos_extra: map.progress.extraCredits.map((e) => ({ nombre: e.name, creditos: e.credits })),
    aplazos: map.failedFinals,
    // Opción A / B del Plan (borradores) y la cursada confirmada con "Confirmar mi cursada".
    plan_del_cuatrimestre: (choices.data ?? []).map((c) => ({
      opcion: c.option,
      ...course(c.offerings as unknown as OfferingRef),
      elegido: c.created_at,
    })),
    cursadas: (courses.data ?? []).map((c) => ({ ...course(c.offerings as unknown as OfferingRef), confirmada: c.created_at })),
    recordatorios_de_finales: reminders.data ?? [],
    // "¿Preferís recibir los avisos en otro mail?" (null: a tu cuenta) y los mails de confirmación enviados.
    mail_para_recordatorios: reminderEmail.error ? null : (reminderEmail.data?.reminder_email ?? null),
    mails_de_confirmacion: confirmations.error ? [] : (confirmations.data ?? []).map((c) => ({ mail: c.email, enviado: c.sent_at })),
    resenas: reviews.map((r) => ({ materia: r.subjectName, curso: r.detail, estrellas: r.stars, comentario: r.comment })),
    ofertas_enviadas: (submissions.data ?? []).map((s) => ({
      enviada: s.created_at,
      cuatrimestre: termLabel(s.term_id),
      plan_id: s.plan_id,
      estado: OFFER_STATUS[s.status] ?? s.status,
      revisada: s.reviewed_at,
      resumen: { materias: s.subjects, cursos: s.courses, horarios: s.blocks },
      texto: s.raw_text,
    })),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="mis-datos.json"',
      "cache-control": "no-store",
    },
  });
}
