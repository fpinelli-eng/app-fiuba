// Checks of a pasted SIU offer, the same for the admin import and for the offer students send.
// Pure functions: the server actions run them after previewImport with the plan's catalog.

import { termFromPeriodo, type ImportPreview } from "../admin/offer-import";
import { MAX_OFFER_CHARS } from "./submission";

const termName = (t: { year: number; half: 1 | 2 }) => `${t.half}C ${t.year}`;

/** Before parsing: empty or too long. */
export function offerTextProblem(text: string): string | null {
  if (!text.trim()) return "Pegá el texto de la página del SIU.";
  if (text.length > MAX_OFFER_CHARS) return "El texto es demasiado largo. Copiá solo la página de la oferta de tu carrera.";
  return null;
}

/**
 * After parsing (previewImport for the plan): the reason the text cannot be the offer of this
 * plan for this term, or null. The same rules for the admin import and for students.
 */
export function offerPreviewProblem(preview: ImportPreview, term: { year: number; half: 1 | 2 }): string | null {
  if (!preview.format) {
    return "No reconocemos el texto. Copiá la página de horarios del SIU completa (Ctrl+A, Ctrl+C) y pegala acá.";
  }
  const fromText = termFromPeriodo(preview.periodo);
  if (fromText && (fromText.year !== term.year || fromText.half !== term.half)) {
    return `El texto es del ${termName(fromText)} y el cuatrimestre actual es el ${termName(term)}.`;
  }
  if (preview.stats.subjects === 0) {
    return "Ninguna materia del texto es de este plan. ¿Elegiste la carrera correcta en el SIU?";
  }
  return null;
}
