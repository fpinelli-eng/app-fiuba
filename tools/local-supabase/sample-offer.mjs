// Sample course offer for local tests: the real Industrial 2C 2026 SIU offer (data/siu),
// loaded as the current term (2C 2026) and as last term (1C 2026, reviews open), plus
// made-up reviews and three courses taken by the test user in 1C 2026.
//
//   node tools/local-supabase/sample-offer.mjs | psql -d app_fiuba_local
//
// Only for the local copy: the real offer is loaded from the admin screen.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const offer = JSON.parse(readFileSync(join(root, "data", "siu", "industrial-2023_2C2026.json"), "utf8"));
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const DAYS = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 7 };
const CAMPUS = { "Paseo Colón": "PC", "Las Heras": "LH", "Ciudad Universitaria": "CU" };
const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const COMMENTS = [
  "Las clases prácticas son muy claras y los TPs están bien pensados. Exigente pero justo.",
  "Buen curso. El parcial fue largo: conviene hacer todos los ejercicios de la guía antes.",
  "Mucho contenido para el tiempo que hay, pero los docentes responden rápido.",
  "Muy buena predisposición del equipo docente.",
];
const TEST_USER = "11111111-1111-1111-1111-111111111111";

const out = [
  "begin;",
  "insert into public.terms (id, year, half, reviews_open_on, is_current) values ('2026-1C', 2026, 1, '2026-07-01', false), ('2026-2C', 2026, 2, '2026-12-01', true);",
];
let courseId = 0;
let offeringId = 0;
const taken = [];
for (const subject of offer.materias) {
  for (const c of subject.comisiones) {
    if (c.es_condicional || !c.numero || /i$/i.test(c.numero)) continue;
    courseId += 1;
    out.push(`insert into public.courses (siu_subject_code) values (${q(subject.codigo)});`);
    const label = `Curso ${Number.parseInt(c.numero, 10)}`;
    const teachers = JSON.stringify([...c.docentes, ...c.subcomisiones.flatMap((s) => s.docentes)]);
    const blocks = [...c.horarios, ...c.subcomisiones.flatMap((s) => s.horarios)];
    for (const term of ["2026-1C", "2026-2C"]) {
      offeringId += 1;
      out.push(
        `insert into public.offerings (term_id, plan_id, course_id, siu_subject_code, siu_subject_name, course_number, label, modality, teachers) values ` +
          `(${q(term)}, 'industrial-2023', ${courseId}, ${q(subject.codigo)}, ${q(subject.nombre)}, ${q(c.numero)}, ${q(label)}, ${q(c.modalidad)}, ${q(teachers)}::jsonb);`,
      );
      for (const b of blocks) {
        if (!DAYS[b.dia]) continue;
        out.push(
          `insert into public.offering_blocks (offering_id, weekday, starts_at, ends_at, class_type, room, campus) values ` +
            `(${offeringId}, ${DAYS[b.dia]}, ${minutes(b.inicio)}, ${minutes(b.fin)}, ${q(b.tipo)}, ${q(b.aula)}, ${q(CAMPUS[b.sede] ?? null)});`,
        );
      }
      if (term === "2026-1C" && taken.length < 3 && ["CB002", "CB001", "TC010"].includes(subject.codigo) && !taken.some((t) => t.code === subject.codigo)) {
        taken.push({ code: subject.codigo, offeringId });
      }
    }
    // Made-up reviews from past students (no author: like deleted accounts).
    const n = Math.floor(rand() * 9);
    for (let i = 0; i < n; i++) {
      const stars = 1 + Math.min(4, Math.floor(rand() * 2.2 + 2.6));
      const comment = rand() < 0.35 ? COMMENTS[Math.floor(rand() * COMMENTS.length)] : null;
      out.push(`insert into public.reviews (course_id, term_id, stars, comment, pinned) values (${courseId}, '2026-1C', ${stars}, ${q(comment)}, ${i === 0 && comment ? "true" : "false"});`);
    }
  }
}
for (const t of taken) out.push(`insert into public.user_courses (user_id, offering_id) values ('${TEST_USER}', ${t.offeringId});`);
out.push("commit;");
process.stdout.write(out.join("\n") + "\n");
console.error(`${courseId} courses, ${offeringId} offerings, ${taken.length} courses taken by the test user`);
