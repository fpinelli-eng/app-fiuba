// Lámina del plan para imprimir (Plan → "Descargar PDF"): una hoja A4 apaisada con la semana del
// alumno, para pegar en la pared. Lógica pura, sin React: arma los datos de la lámina a partir del
// plan, comprime las horas a las que se usan y ubica cada bloque en su día. La dibuja
// src/components/PlanPoster.tsx; la usan /plan/imprimir y la vista previa pública.

import type { Campus } from "../siu/parser";
import { type ActivityBlock, type ActivityColor, type PlanActivity } from "./activities";
import type { OptionKey, PlanData } from "./data";
import { DAY_SHORT, formatHour, isVirtualRoom } from "./format";
import { WEEK_DAYS, type ClassBlock, type WeekDay } from "./options";

/** Mismo orden que PALETTE (src/app/(app)/plan/shared.tsx): cada materia sale del color que tiene en el Plan. */
export const POSTER_COLORS = ["lavender", "mint", "butter", "sky", "peach", "pink", "teal"] as const;
export type PosterColor = (typeof POSTER_COLORS)[number];

export interface PosterCourse {
  name: string;
  credits: number | null;
  /** "Curso 1 · práctica A" */
  label: string;
  /** "Vargas, Torlasco, Jalife" */
  teachers: string;
  color: PosterColor;
  blocks: ClassBlock[];
}

export interface PosterActivity {
  name: string;
  place: string | null;
  color: ActivityColor;
  blocks: ActivityBlock[];
}

export interface PosterData {
  /** "2C 2026" */
  term: string;
  /** "Ing. Industrial · Plan 2023" */
  career: string;
  /** La opción que se imprime; null si el alumno usa una sola (no hace falta nombrarla). */
  option: OptionKey | null;
  courses: PosterCourse[];
  activities: PosterActivity[];
}

/** La opción del plan que se está viendo, como lámina. La otra opción solo decide si se nombra. */
export function posterFromPlan(data: PlanData, option: OptionKey): PosterData {
  const subjects = new Map(data.subjects.map((s) => [s.code, s]));
  const courses: PosterCourse[] = [];
  for (const entry of data.saved[option]) {
    const subject = subjects.get(entry.subject);
    const course = subject?.courses.find((c) => c.id === entry.course);
    if (!subject || !course) continue;
    courses.push({
      name: subject.name,
      credits: subject.credits,
      label: course.label,
      teachers: course.teacherList,
      // Como en el Plan: el color va por el lugar de la materia en la opción.
      color: POSTER_COLORS[courses.length % POSTER_COLORS.length],
      blocks: course.blocks,
    });
  }
  const other: OptionKey = option === "A" ? "B" : "A";
  return {
    term: data.term ?? "",
    career: data.career,
    option: data.saved[other].length > 0 ? option : null,
    courses,
    activities: (data.activities ?? []).map(toPosterActivity),
  };
}

const toPosterActivity = (a: PlanActivity): PosterActivity => ({ name: a.name, place: a.place, color: a.color, blocks: a.blocks });

/** Una clase o un horario de actividad, como va en la grilla. */
export interface PosterItem {
  kind: "course" | "activity";
  /** Posición en courses o en activities. */
  index: number;
  day: WeekDay;
  start: number;
  end: number;
  /** Tipo de clase ya abreviado ("Teórica"); vacío en las actividades. */
  type: string;
  room: string | null;
  campus: Campus | null;
}

/**
 * Todo lo que va en la grilla: las clases presenciales o sincrónicas (las asincrónicas no tienen
 * horario) y las actividades. Las clases seguidas de un mismo curso y día van en un solo bloque
 * (teórica 16–17:30 + práctica 17:30–19 = "16–19 · Teórica + Práctica"), con sus aulas juntas.
 */
export function posterItems(p: PosterData): PosterItem[] {
  return [
    ...p.courses.flatMap((c, index) => {
      const sorted = c.blocks
        .filter((b) => !b.async)
        .sort((a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day) || a.start - b.start);
      const merged: PosterItem[] = [];
      for (const b of sorted) {
        const type = shortClassType(b.type);
        const last = merged[merged.length - 1];
        if (last && last.day === b.day && b.start === last.end) {
          last.end = b.end;
          if (type && !last.type.split(" + ").includes(type)) last.type = last.type ? `${last.type} + ${type}` : type;
          if (b.room && b.room !== last.room) last.room = last.room ? `${last.room}, ${b.room}` : b.room;
          last.campus ??= b.campus;
        } else merged.push({ kind: "course", index, day: b.day, start: b.start, end: b.end, type, room: b.room, campus: b.campus });
      }
      return merged;
    }),
    ...p.activities.flatMap((a, index) =>
      a.blocks.map((b): PosterItem => ({ kind: "activity", index, day: b.day, start: b.start, end: b.end, type: "", room: a.place, campus: null })),
    ),
  ];
}

const WEEK_ORDER: WeekDay[] = [...WEEK_DAYS, "Domingo"];

/** Lunes a viernes siempre; el sábado y el domingo, solo si hay algo ese día (así cada día gana ancho). */
export function posterDays(items: { day: WeekDay }[]): WeekDay[] {
  const weekend: WeekDay[] = ["Sábado", "Domingo"];
  return [...WEEK_DAYS.slice(0, 5), ...weekend.filter((d) => items.some((i) => i.day === d))];
}

/** Al menos esta cantidad de horas, para que un plan de una sola clase no quede con bloques gigantes. */
export const MIN_HOURS = 6;

/**
 * Horas de la grilla: de la primera hora en punto con clase a la última, nada más (la oferta va
 * de 7 a 23, pero casi nadie usa todo). Sin clases, de 8 a 20.
 */
export function posterHours(items: { start: number; end: number }[]): { first: number; last: number } {
  if (items.length === 0) return { first: 8, last: 20 };
  let first = Math.floor(Math.min(...items.map((i) => i.start)) / 60);
  let last = Math.ceil(Math.max(...items.map((i) => i.end)) / 60);
  if (last - first < MIN_HOURS) {
    // Se agranda hacia la mañana: lo de la noche queda donde está.
    first = Math.max(0, last - MIN_HOURS);
    last = Math.max(last, first + MIN_HOURS);
  }
  return { first, last };
}

/**
 * Carriles de un día: lo que se pisa se reparte el ancho de la columna. Cada grupo de bloques que se
 * pisan (aunque sea en cadena) tiene sus propios carriles, así una superposición del lunes a la
 * mañana no achica la clase del lunes a la noche.
 */
export function placeInDay<T extends { start: number; end: number }>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let lanesEnd: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const g of group) g.lanes = lanesEnd.length;
    out.push(...group);
    group = [];
    lanesEnd = [];
  };
  for (const item of sorted) {
    if (group.length && item.start >= groupEnd) close();
    let lane = lanesEnd.findIndex((end) => end <= item.start);
    if (lane < 0) {
      lane = lanesEnd.length;
      lanesEnd.push(item.end);
    } else lanesEnd[lane] = item.end;
    groupEnd = Math.max(group.length ? groupEnd : -1, item.end);
    group.push({ ...item, lane, lanes: 0 });
  }
  if (group.length) close();
  return out;
}

/** Posición vertical de un bloque, en porcentaje del alto de la grilla (sirve igual en pantalla y en papel). */
export function blockBox(start: number, end: number, hours: { first: number; last: number }): { top: number; height: number } {
  const total = (hours.last - hours.first) * 60;
  return {
    top: ((start - hours.first * 60) / total) * 100,
    height: ((end - start) / total) * 100,
  };
}

/**
 * Cuánto texto entra en un bloque según su alto en milímetros: 1 solo el nombre, 2 suma la hora y
 * el tipo de clase, 3 el aula y la sede, 4 el curso y los docentes.
 */
export function blockDetail(heightMm: number): 1 | 2 | 3 | 4 {
  if (heightMm >= 19) return 4;
  if (heightMm >= 13.5) return 3;
  if (heightMm >= 8.5) return 2;
  return 1;
}

/** "Teórico Práctica Obligatoria" → "Teórico-práctica"; "Práctica Obligatoria" → "Práctica". */
export function shortClassType(type: string): string {
  const t = type
    .replace(/\s*obligatori[ao]s?\b/gi, "")
    .replace(/^te[oó]rico[\s-]+pr[aá]ctic[ao]s?$/i, "Teórico-práctica")
    .trim();
  return t ? t.charAt(0).toLocaleUpperCase("es") + t.slice(1) : "";
}

const CAMPUS_SHORT: Record<Campus, string> = { "Paseo Colón": "PC", "Las Heras": "LH", "Ciudad Universitaria": "CU" };

/**
 * Dónde es la clase, corto para el bloque: "Aula 403 · PC", "Anf.III · LH", "Virtual". El SIU repite
 * la sede en el aula ("403 - PC"): se saca, porque la sede va aparte.
 */
export function placeLabel(room: string | null, campus: Campus | null): string {
  if (isVirtualRoom(room)) return "Virtual";
  const clean = (room ?? "")
    .replace(/\s*-\s*(PC|LH|CU)\b/g, "")
    .replace(/^a\s*asign\w*$/i, "")
    .trim();
  const where = campus ? CAMPUS_SHORT[campus] : "";
  const aula = clean ? (/^\d/.test(clean) ? `Aula ${clean}` : clean) : where ? "Aula a confirmar" : "";
  return [aula, where].filter(Boolean).join(" · ") || "Sede a confirmar";
}

/** "Mar 18–20 y Sáb 10–13" (los horarios de una actividad, en la lista de al lado de la grilla). */
export function timesLabel(blocks: ActivityBlock[]): string {
  const times = blocks.map((b) => `${DAY_SHORT[b.day]} ${formatHour(b.start)}–${formatHour(b.end)}`);
  return times.length > 1 ? `${times.slice(0, -1).join(", ")} y ${times[times.length - 1]}` : (times[0] ?? "");
}

export interface PosterTotals {
  subjects: number;
  /** Solo de las materias con créditos conocidos. */
  credits: number;
  /** Clases con horario, en minutos por semana (sin las actividades). */
  weeklyMinutes: number;
  asyncMinutes: number;
}

export function posterTotals(p: PosterData): PosterTotals {
  let weeklyMinutes = 0;
  let asyncMinutes = 0;
  for (const c of p.courses) {
    for (const b of c.blocks) {
      if (b.async) asyncMinutes += b.end - b.start;
      else weeklyMinutes += b.end - b.start;
    }
  }
  return {
    subjects: p.courses.length,
    credits: p.courses.reduce((sum, c) => sum + (c.credits ?? 0), 0),
    weeklyMinutes,
    asyncMinutes,
  };
}
