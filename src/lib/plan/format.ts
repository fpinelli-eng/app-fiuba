// Formatos de texto del plan del cuatrimestre (convenciones de CLAUDE.md):
// horarios como "Lun 18–22 hs · Paseo Colón", decimales con coma.

import type { ClassBlock, WeekDay } from "./options";

export const DAY_SHORT: Record<WeekDay, string> = {
  Lunes: "Lun",
  Martes: "Mar",
  Miércoles: "Mié",
  Jueves: "Jue",
  Viernes: "Vie",
  Sábado: "Sáb",
  Domingo: "Dom",
};

const DAY_ORDER: WeekDay[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** 1080 → "18", 1110 → "18:30" */
export function formatHour(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}:${String(m).padStart(2, "0")}` : String(h);
}

/** 150 → "2,5" */
export function formatHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10).replace(".", ",");
}

export function isVirtualRoom(room: string | null): boolean {
  return room !== null && /virtual|remot/i.test(room);
}

/**
 * "Lun 9–13 hs y Mié 9–13 hs · Paseo Colón". Las clases seguidas del mismo día se unen
 * (teórica 9–11 + práctica 11–13 = 9–13). Las asincrónicas no van acá.
 */
export function describeSchedule(blocks: ClassBlock[]): string {
  const inPerson = blocks
    .filter((b) => !b.async)
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start - b.start);
  if (inPerson.length === 0) return "";

  const merged: { day: WeekDay; start: number; end: number }[] = [];
  for (const b of inPerson) {
    const last = merged[merged.length - 1];
    if (last && last.day === b.day && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else merged.push({ day: b.day, start: b.start, end: b.end });
  }
  const times = merged.map((t) => `${DAY_SHORT[t.day]} ${formatHour(t.start)}–${formatHour(t.end)} hs`);
  const when = times.length > 1 ? `${times.slice(0, -1).join(", ")} y ${times[times.length - 1]}` : times[0];

  const places = new Set<string>();
  for (const b of inPerson) {
    if (b.campus) places.add(b.campus);
    else if (isVirtualRoom(b.room)) places.add("Virtual");
  }
  const where = places.size ? [...places].join(" / ") : "Sede a confirmar";
  return `${when} · ${where}`;
}

const LOWERCASE_WORDS = new Set(["a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "los", "o", "para", "por", "u", "y"]);
const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

/** "INTRODUCCIÓN A LA INTELIGENCIA ARTIFICIAL" → "Introducción a la Inteligencia Artificial" */
export function titleCase(text: string): string {
  return text
    .toLocaleLowerCase("es")
    .split(/(\s+)/)
    .map((word, i) => {
      if (ROMAN.test(word)) return word.toUpperCase();
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("es") + word.slice(1);
    })
    .join("");
}

const PARTICLES = new Set(["DE", "DEL", "DI", "DA", "LA", "LOS", "VAN", "VON", "MC", "MAC"]);

/**
 * Apellido de un docente del SIU ("PONCE DE LEON ROBLES FABIAN ARTURO"). El SIU no separa
 * apellido y nombre, así que se usan como pista los apellidos que aparecen en los nombres de
 * los cursos ("CURSO 01B - VARGAS/PONCE DE LEON"). Sin pista, la primera palabra.
 */
export function surname(fullName: string, hints: string[]): string {
  const name = fullName.toUpperCase();
  const hint = hints
    .filter((h) => name === h || name.startsWith(`${h} `))
    .sort((a, b) => b.length - a.length)[0];
  if (hint) return titleCase(hint);
  const words = name.split(/\s+/);
  let i = 0;
  while (i < words.length - 1 && PARTICLES.has(words[i])) i++;
  return titleCase(words.slice(0, i + 1).join(" "));
}

/** Hasta 3 apellidos y "+N" si hay más, como en el diseño. */
export function shortTeacherList(surnames: string[]): string {
  const unique = [...new Set(surnames)];
  const shown = unique.slice(0, 3).join(", ");
  return unique.length > 3 ? `${shown} +${unique.length - 3}` : shown;
}
