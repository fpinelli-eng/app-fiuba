// Actividades propias del alumno en el plan del cuatrimestre (ayudantías, trabajo, gimnasio):
// se ven en el calendario semanal junto a los cursos y cuentan para las superposiciones.
// Lógica pura, sirve en el cliente y en el servidor. Tabla: plan_activities (migración
// 20261119130000_plan_actividades.sql), una fila por actividad y cuatrimestre; vale para la
// Opción A y la B.

import { WEEK_DAYS, type ClassBlock, type WeekDay } from "./options";

export const ACTIVITY_COLORS = ["lavender", "mint", "butter", "sky", "peach", "pink"] as const;
export type ActivityColor = (typeof ACTIVITY_COLORS)[number];

export const MAX_NAME = 60;
export const MAX_PLACE = 80;
export const MAX_BLOCKS = 10;
export const MAX_ACTIVITIES = 30;

/** Lunes a domingo, en el orden de weekday (1 = lunes … 7 = domingo). */
export const ALL_DAYS: WeekDay[] = [...WEEK_DAYS, "Domingo"];

export interface ActivityBlock {
  day: WeekDay;
  /** Minutos desde la medianoche. */
  start: number;
  end: number;
}

export interface PlanActivity {
  id: string;
  name: string;
  place: string | null;
  color: ActivityColor;
  blocks: ActivityBlock[];
}

/** Lo que manda el formulario (sin id). */
export type ActivityInput = Omit<PlanActivity, "id">;

/** Fila de la base. */
export interface ActivityRow {
  id: number;
  name: string;
  place: string | null;
  color: string;
  blocks: { weekday: number; starts_at: number; ends_at: number }[];
}

/** Id de una actividad en el análisis del plan, para no confundirla con un curso. */
export const activityKey = (id: string) => `actividad:${id}`;
export const isActivityKey = (key: string) => key.startsWith("actividad:");

const isColor = (c: unknown): c is ActivityColor => typeof c === "string" && (ACTIVITY_COLORS as readonly string[]).includes(c);

/**
 * Revisa y limpia lo que cargó el alumno: nombre y lugar sin espacios de más, entre 1 y 10
 * horarios, cada uno que termine después de empezar y dentro del día, sin pisarse entre sí.
 * Devuelve el problema en castellano para mostrarlo en el formulario.
 */
export function validateActivity(input: unknown): { value: ActivityInput; error: null } | { value: null; error: string } {
  const fail = (error: string) => ({ value: null, error });
  if (!input || typeof input !== "object") return fail("Faltan los datos de la actividad.");
  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return fail("Ponele un nombre a la actividad.");
  if (name.length > MAX_NAME) return fail(`El nombre puede tener hasta ${MAX_NAME} letras.`);
  const placeText = typeof raw.place === "string" ? raw.place.trim().replace(/\s+/g, " ") : "";
  if (placeText.length > MAX_PLACE) return fail(`El lugar o la nota puede tener hasta ${MAX_PLACE} letras.`);
  if (!isColor(raw.color)) return fail("Elegí un color.");
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) return fail("Agregá al menos un horario.");
  if (raw.blocks.length > MAX_BLOCKS) return fail(`Podés cargar hasta ${MAX_BLOCKS} horarios por actividad.`);

  const blocks: ActivityBlock[] = [];
  for (const b of raw.blocks as unknown[]) {
    const block = b as Partial<ActivityBlock> | null;
    if (!block || !ALL_DAYS.includes(block.day as WeekDay)) return fail("Elegí el día de cada horario.");
    const { start, end } = block;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return fail("Completá la hora de inicio y de fin de cada horario.");
    if (start! < 0 || end! > 24 * 60) return fail("Revisá las horas: tienen que estar dentro del día.");
    if (end! <= start!) return fail("Cada horario tiene que terminar después de empezar.");
    blocks.push({ day: block.day as WeekDay, start: start!, end: end! });
  }
  blocks.sort((a, b) => ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day) || a.start - b.start);
  for (let i = 1; i < blocks.length; i++) {
    const a = blocks[i - 1];
    const b = blocks[i];
    if (a.day === b.day && b.start < a.end) return fail("Dos horarios de la actividad se pisan: unilos en uno.");
  }
  return { value: { name, place: placeText || null, color: raw.color, blocks }, error: null };
}

export function fromRow(row: ActivityRow): PlanActivity {
  return {
    id: String(row.id),
    name: row.name,
    place: row.place,
    color: isColor(row.color) ? row.color : "lavender",
    blocks: (Array.isArray(row.blocks) ? row.blocks : [])
      .filter((b) => b.weekday >= 1 && b.weekday <= 7 && b.starts_at < b.ends_at)
      .map((b) => ({ day: ALL_DAYS[b.weekday - 1], start: b.starts_at, end: b.ends_at })),
  };
}

export function toRow(a: ActivityInput) {
  return {
    name: a.name,
    place: a.place,
    color: a.color,
    blocks: a.blocks.map((b) => ({ weekday: ALL_DAYS.indexOf(b.day) + 1, starts_at: b.start, ends_at: b.end })),
  };
}

/** Color sugerido para una actividad nueva: el primero que no usa otra (arranca por el celeste). */
export function nextColor(activities: { color: ActivityColor }[]): ActivityColor {
  const order: ActivityColor[] = ["sky", "butter", "pink", "mint", "peach", "lavender"];
  return order.find((c) => !activities.some((a) => a.color === c)) ?? order[activities.length % order.length];
}

/** Los horarios de una actividad como clases del calendario: presenciales, sin sede. */
export function activityClassBlocks(a: PlanActivity): ClassBlock[] {
  return a.blocks.map((b) => ({ day: b.day, start: b.start, end: b.end, type: "Actividad", room: a.place, campus: null, async: false }));
}

/**
 * Días que muestra el calendario: de lunes a sábado (los de la oferta), y el domingo solo si hay
 * algo ese día.
 */
export function daysToShow(blocks: { day: WeekDay }[]): WeekDay[] {
  return blocks.some((b) => b.day === "Domingo") ? ALL_DAYS : [...WEEK_DAYS];
}

/**
 * Horas que muestra el calendario: de 7 a 23 como siempre, y más si una actividad empieza antes
 * o termina después (el gimnasio a las 6).
 */
export function hourRange(blocks: { start: number; end: number }[], first = 7, last = 23): { first: number; last: number } {
  let from = first;
  let to = last;
  for (const b of blocks) {
    from = Math.min(from, Math.floor(b.start / 60));
    to = Math.max(to, Math.ceil(b.end / 60));
  }
  return { first: from, last: to };
}

/** Posición de un bloque en una columna del calendario, en píxeles. */
export function blockPosition(start: number, end: number, firstHour: number, hourPx: number): { top: number; height: number } {
  return {
    top: ((start - firstHour * 60) / 60) * hourPx + 1,
    height: ((end - start) / 60) * hourPx - 3,
  };
}

/** "18:30" → 1110; "" o inválido → null. "24:00" vale como fin del día. */
export function parseTime(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** 1110 → "18:30" (para los campos de hora). */
export function timeValue(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
