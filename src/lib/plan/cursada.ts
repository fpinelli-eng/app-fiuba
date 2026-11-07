import type { DisplayState } from "@/lib/map/model";
import type { Entry } from "./data";

// "Confirmar mi cursada": lógica pura del paso que pasa al Inicio lo que el alumno
// realmente cursa. Las opciones A y B son borradores y no se tocan.

/** Same set of courses, in any order. */
export function sameCourses(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((c) => set.has(c));
}

/** The confirmed courses as entries (subject + course), in the order of the subjects on screen. */
export function enrolledEntries(enrolled: string[], subjects: { code: string; courses: { id: string }[] }[]): Entry[] {
  const set = new Set(enrolled);
  return subjects.flatMap((s) => {
    const course = s.courses.find((c) => set.has(c.id));
    return course ? [{ subject: s.code, course: course.id }] : [];
  });
}

/** What the confirmation starts from: the confirmed cursada if there is one, otherwise the option on screen. */
export function startingEntries(enrolled: Entry[], option: Entry[]): Entry[] {
  return (enrolled.length ? enrolled : option).map((e) => ({ ...e }));
}

/**
 * Whether a subject shows up in the Plan: enabled or in progress in the map, or already part of
 * this term (in option A or B, or in the confirmed cursada) whatever the map says now. Passing the
 * cursada ("Final pendiente") or approving it does not end the classes: the subject stays until
 * the term changes.
 */
export function inPlan(state: DisplayState, chosenThisTerm: boolean): boolean {
  return chosenThisTerm || state === "enabled" || state === "in_progress";
}
