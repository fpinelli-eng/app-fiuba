import { NextResponse } from "next/server";
import { getMapData } from "@/lib/map/data";
import { getMyReviews } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

// "Descargar mis datos": todo lo que la app guarda del alumno, en un archivo JSON.
export async function GET() {
  const account = await requireProfile();
  const supabase = await createClient();
  const [map, reviews, courses] = await Promise.all([
    getMapData(account.id, account.planId!),
    getMyReviews(),
    supabase
      .from("user_courses")
      .select("created_at, offerings(term_id, siu_subject_code, siu_subject_name, label)")
      .eq("user_id", account.id),
  ]);
  if (courses.error) return NextResponse.json({ error: courses.error.message }, { status: 500 });

  const byId = new Map(map.subjects.map((s) => [s.id, s]));
  const data = {
    descargado: new Date().toISOString(),
    cuenta: { mail: account.email, nombre: account.fullName, administrador: account.isAdmin },
    carrera: { carrera: map.careerName, plan: map.year, plan_id: map.planId },
    materias: map.progress.subjects.map((s) => ({
      codigo: byId.get(s.subjectId)?.code ?? null,
      materia: byId.get(s.subjectId)?.name ?? null,
      estado: { approved: "aprobada", final_pending: "final pendiente", in_progress: "cursando" }[s.status],
      nota: s.grade,
    })),
    requisitos_aprobados: map.requirements.filter((r) => map.progress.requirements.includes(r.id)).map((r) => r.name),
    cursadas: courses.data,
    resenas: reviews.map((r) => ({ materia: r.subjectName, curso: r.detail, estrellas: r.stars, comentario: r.comment })),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="mis-datos.json"',
      "cache-control": "no-store",
    },
  });
}
