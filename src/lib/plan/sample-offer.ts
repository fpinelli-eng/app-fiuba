// Solo se usa desde la página (componente de servidor).
// Datos de prueba del plan del cuatrimestre mientras no exista la base de datos (#3):
// la oferta real de Ing. Industrial del 2C 2026 (salida del intérprete del SIU) cruzada por
// nombre con el plan 2023 de FIUBA Map para sacar créditos, nombre y si es obligatoria.
// Cuando la oferta y los planes estén en la base, esto se reemplaza por una consulta y la
// pantalla no cambia: recibe la misma lista de PlanSubject.

import offerData from "../../../data/siu/industrial-2023_2C2026.json";
import planData from "../../../data/planes/industrial-2020.json";
import type { Offer } from "../siu/parser";
import { titleCase, surname, shortTeacherList } from "./format";
import { courseOptions, type CourseOption } from "./options";

export type SubjectGroup = "obligatorias" | "electivas" | "otras";

export interface PlanCourse extends CourseOption {
  /** "Vargas, Torlasco, Jalife" */
  teacherList: string;
}

export interface PlanSubject {
  code: string;
  name: string;
  credits: number | null;
  group: SubjectGroup;
  courses: PlanCourse[];
}

export interface PlanData {
  /** "2C 2026" */
  term: string;
  career: string;
  subjects: PlanSubject[];
}

interface MapSubject {
  materia: string;
  creditos: number;
  categoria: string;
  level: number;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** "2026 - 2do Cuatrimestre" → "2C 2026" */
function shortTerm(periodo: string | null): string {
  const m = periodo?.match(/(\d{4}).*?(\d)/);
  return m ? `${m[2]}C ${m[1]}` : (periodo ?? "");
}

/** Apellidos escritos en los nombres de los cursos: "CURSO 01B - VARGAS/PONCE DE LEON". */
function surnameHints(offer: Offer["materias"][number]): string[] {
  const names = offer.comisiones.flatMap((c) => [c.nombre, ...c.subcomisiones.map((s) => s.nombre)]);
  return names.flatMap((n) => {
    const after = n.split(" - ").slice(1).join(" - ").replace(/\(.*?\)/g, "");
    return after.split("/").map((s) => s.trim().toUpperCase()).filter(Boolean);
  });
}

export function getSamplePlanData(): PlanData {
  const offer = offerData as Offer;
  const plan = new Map((planData as MapSubject[]).map((m) => [normalize(m.materia), m]));
  const order = (s: PlanSubject, m?: MapSubject) => [s.group, m?.level ?? 99, s.name] as const;

  const subjects = offer.materias
    .map((subject) => {
      const match = plan.get(normalize(subject.nombre));
      const hints = surnameHints(subject);
      const group: SubjectGroup = !match
        ? "otras"
        : match.categoria === "Materias Electivas"
          ? "electivas"
          : "obligatorias";
      const planSubject: PlanSubject = {
        code: subject.codigo,
        name: match?.materia ?? titleCase(subject.nombre),
        credits: match?.creditos ?? null,
        group,
        courses: courseOptions(subject).map((option) => ({
          ...option,
          teacherList: shortTeacherList(option.teachers.map((t) => surname(t.nombre, hints))),
        })),
      };
      return { planSubject, key: order(planSubject, match) };
    })
    .filter(({ planSubject }) => planSubject.courses.length > 0);

  const groupRank: Record<SubjectGroup, number> = { obligatorias: 0, electivas: 1, otras: 2 };
  subjects.sort(
    (a, b) =>
      groupRank[a.key[0]] - groupRank[b.key[0]] ||
      a.key[1] - b.key[1] ||
      a.key[2].localeCompare(b.key[2], "es"),
  );

  return {
    term: shortTerm(offer.periodo),
    career: "Ing. Industrial",
    subjects: subjects.map((s) => s.planSubject),
  };
}
