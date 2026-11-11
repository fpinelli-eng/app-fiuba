// Offer sent by students (Plan without offer → paste the SIU text): what the student sees.
// Pure, safe for the client. The checks of the text are in ./check.ts.

/** Same limit as the database (offer_submissions.raw_text). The longest real text is ~125 000. */
export const MAX_OFFER_CHARS = 400_000;

export type SubmissionStatus = "pending" | "published" | "rejected";

export interface MySubmission {
  status: SubmissionStatus;
  createdAt: string;
  subjects: number;
  courses: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Encontramos 34 materias y 120 cursos de tu plan." */
export function submissionSummary(stats: { subjects: number; courses: number }): string {
  return `Encontramos ${plural(stats.subjects, "materia", "materias")} y ${plural(stats.courses, "curso", "cursos")} de tu plan.`;
}

/** The trigger of offer_submissions says why it refused (hint), in the student's words. */
export function submissionRefusal(hint: string | null | undefined): string {
  switch (hint) {
    case "pending_limit":
      return "Ya tenés ofertas enviadas esperando revisión. Esperá a que las revisemos.";
    case "daily_limit":
      return "Mandaste muchas veces hoy. Probá de nuevo mañana.";
    case "already_published":
      return "La oferta de tu plan ya está cargada. Recargá la página.";
    default:
      return "No pudimos guardar el texto. Probá de nuevo.";
  }
}

/** "11/11" in Buenos Aires. */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

/** What the student sees about their latest submission, or null to just show the form. */
export function submissionStatusText(s: MySubmission | null): string | null {
  if (!s) return null;
  if (s.status === "pending") {
    return `Recibimos la oferta que mandaste el ${shortDate(s.createdAt)} (${plural(s.subjects, "materia", "materias")} y ${plural(s.courses, "curso", "cursos")}). La estamos revisando: en breve vas a poder armar tu cuatrimestre.`;
  }
  if (s.status === "rejected") {
    return `No pudimos usar la oferta que mandaste el ${shortDate(s.createdAt)}. Probá de nuevo copiando la página completa.`;
  }
  return null;
}
