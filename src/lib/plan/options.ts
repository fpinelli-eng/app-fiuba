// Turns a subject from the parsed SIU offer into the courses a student can pick in the
// semester plan. A course without practice groups is one option; a course with practice
// groups ("CURSO 01A", "CURSO 01B") gives one option per group, each with the shared
// lectures included.

import type { Campus, Commission, ScheduleBlock, Subject, Teacher } from "../siu/parser";

export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number] | "Domingo";

export interface ClassBlock {
  day: WeekDay;
  /** Minutes since midnight. */
  start: number;
  end: number;
  type: string;
  room: string | null;
  /** null for virtual classes and rooms without a known campus. */
  campus: Campus | null;
  /** Asynchronous classes stay out of the weekly grid and never raise warnings. */
  async: boolean;
}

export interface CourseOption {
  /** Stable within an offer: subject code + course number + practice letter, e.g. "CB002-01A". */
  id: string;
  subjectCode: string;
  subjectName: string;
  /** "Curso 1" or "Curso 1 · práctica A", as in the design */
  label: string;
  courseNumber: string | null;
  practice: string | null;
  /** Lecturers first, then practice teachers. */
  teachers: Teacher[];
  /** "Promoción" | "Regularidad" */
  modality: string | null;
  blocks: ClassBlock[];
  quota: number | null;
  enrolled: number | null;
}

// Course number and practice letter from a (sub)commission name. The SIU has typos like
// "CURS 03 - MOREY" or "CURSO 12- CENTENO", so the prefix is matched loosely.
const RE_NUMBER = /^CURS\w*\s*(\d+)([A-Z]*)/i;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isAsync(type: string): boolean {
  return /asincr/i.test(type); // "Teórica Asincrónica"
}

function isVirtual(room: string | null): boolean {
  return room !== null && /virtual|remot/i.test(room);
}

function toBlock(h: ScheduleBlock): ClassBlock {
  return {
    day: h.dia as WeekDay,
    start: toMinutes(h.inicio),
    end: toMinutes(h.fin),
    type: h.tipo,
    room: h.aula,
    campus: isVirtual(h.aula) ? null : h.sede,
    async: isAsync(h.tipo),
  };
}

function uniqueTeachers(teachers: Teacher[]): Teacher[] {
  const seen = new Set<string>();
  return teachers.filter((t) => !seen.has(t.nombre) && seen.add(t.nombre));
}

function practiceLetter(name: string): string {
  return RE_NUMBER.exec(name)?.[2].toUpperCase() ?? "";
}

/** "i" courses ("CURSO 01i") repeat their base course with a few extra seats. */
function isExtraSeatsCopy(c: Commission, all: Commission[]): boolean {
  if (!c.numero || !/i$/i.test(c.numero)) return false;
  const base = c.numero.slice(0, -1);
  return all.some((other) => other.numero === base);
}

export function courseOptions(subject: Subject): CourseOption[] {
  const options: CourseOption[] = [];

  for (const c of subject.comisiones) {
    if (c.es_condicional || isExtraSeatsCopy(c, subject.comisiones)) continue;

    const number = c.numero ? (RE_NUMBER.exec(`CURSO ${c.numero}`)?.[1] ?? c.numero) : null;
    const base = {
      subjectCode: subject.codigo,
      subjectName: subject.nombre,
      courseNumber: number,
      modality: c.modalidad ?? null,
    };
    const label = number ? `Curso ${Number(number)}` : c.nombre;
    const practices = c.subcomisiones.filter((s) => practiceLetter(s.nombre) !== "");
    const shared = c.subcomisiones.filter((s) => practiceLetter(s.nombre) === "");
    const sharedBlocks = [...c.horarios, ...shared.flatMap((s) => s.horarios)];
    const sharedTeachers = [...c.docentes, ...shared.flatMap((s) => s.docentes)];

    if (practices.length === 0) {
      const counted = shared[0] ?? c;
      options.push({
        ...base,
        id: `${subject.codigo}-${number ?? c.nombre}`,
        label,
        practice: null,
        teachers: uniqueTeachers(sharedTeachers),
        blocks: sharedBlocks.map(toBlock),
        quota: counted.cupo ?? null,
        enrolled: counted.inscriptos ?? null,
      });
      continue;
    }

    for (const p of practices) {
      const letter = practiceLetter(p.nombre);
      options.push({
        ...base,
        id: `${subject.codigo}-${number ?? c.nombre}${letter}`,
        label: `${label} · práctica ${letter}`,
        practice: letter,
        teachers: uniqueTeachers([...sharedTeachers, ...p.docentes]),
        blocks: [...sharedBlocks, ...p.horarios].map(toBlock),
        quota: p.cupo ?? null,
        enrolled: p.inscriptos ?? null,
      });
    }
  }

  return options;
}
