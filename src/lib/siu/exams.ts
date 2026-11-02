// Parser for the public "Fechas de examen" page of FIUBA's SIU-Guaraní
// (guaraniautogestion.fi.uba.ar/g3w/fecha_examen), as copied by an admin (Ctrl+A, Ctrl+C).
//
//   ECONOMÍA (TC010)
//   Mesa de examen  Fecha  Tipo de inscripción  Inicio de inscripción  Fin de inscripción
//   Mesa 1 Surace   11/12/2026  Regular  16/11/2026 08:00  09/12/2026 23:59  Ver
//
// The "Ver" details (time, room, teachers) are hidden until clicked, so they are not in the copy.

export interface ExamTable {
  /** "MESA 01", "Mesa 1 Surace", "LLAMADO 2" */
  name: string;
  /** Exam day, "YYYY-MM-DD". */
  date: string;
  /** "Regular", "Libre", "Reválida de Cursada"… */
  kind: string;
  /** Enrollment window, "YYYY-MM-DDTHH:MM" (Buenos Aires time), when the SIU gives it. */
  enrollFrom: string | null;
  enrollTo: string | null;
}

export interface ExamSubject {
  /** SIU code: "TC010", "8102", "RID-2023" */
  code: string;
  name: string;
  tables: ExamTable[];
}

export interface ExamParseResult {
  subjects: ExamSubject[];
  /** Notes for the admin: corrected years, windows that end before they start, unknown lines. */
  warnings: string[];
  /** The filters chosen in the SIU, when the copy includes them ("Ingeniería Industrial", "2023"). */
  career: string | null;
  plan: string | null;
}

const RE_SUBJECT = /^(.+?) \(\s*([A-Z0-9][A-Z0-9-]*)\s*\)$/;
const RE_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const RE_DATETIME = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?$/;
const RE_LINE_BREAK = /\r\n|[\n\r]/;
const HEADER = "Mesa de examen\t";
const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (s: string): string | null => {
  const m = s.match(RE_DATE);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const toDateTime = (s: string): string | null => {
  const m = s.trim().match(RE_DATETIME);
  if (!m) return null;
  const hh = (m[4] ?? "00").padStart(2, "0");
  return `${m[3]}-${m[2]}-${m[1]}T${hh}:${m[5] ?? "00"}`;
};

const time = (iso: string) => Date.parse(`${iso}:00Z`);

/** The value under a filter label in the copied search form, unless it is a placeholder. */
function filterValue(lines: string[], label: string): string | null {
  const i = lines.findIndex((l) => l.trim() === label);
  if (i < 0) return null;
  const value = lines.slice(i + 1).find((l) => l.trim())?.trim() ?? null;
  return !value || value.startsWith("--") ? null : value;
}

export function parseSiuExams(text: string): ExamParseResult {
  const lines = text.split(RE_LINE_BREAK);
  const subjects: ExamSubject[] = [];
  const warnings: string[] = [];
  let subject: ExamSubject | null = null;

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const warn = (msg: string) => warnings.push(`línea ${i + 1}: ${msg}`);

    const subjectMatch = !rawLine.includes("\t") && line.match(RE_SUBJECT);
    if (subjectMatch) {
      subject = { code: subjectMatch[2], name: subjectMatch[1].trim(), tables: [] };
      subjects.push(subject);
      return;
    }
    // Everything before the first subject is the page menu and the search form.
    if (!subject) return;
    if (rawLine.startsWith(HEADER)) return;

    const parts = rawLine.split("\t").map((p) => p.trim());
    const date = parts.length >= 5 ? toDate(parts[1]) : null;
    if (!date) return warn(`no reconocida '${Array.from(line).slice(0, 60).join("")}'`);

    const [name, , kind] = parts;
    let enrollFrom = toDateTime(parts[3]);
    const enrollTo = toDateTime(parts[4]);
    if (enrollFrom && enrollTo) {
      // Typo seen in the SIU: "27/01/2026 18:00" to "02/02/2027" for a February 2027 exam.
      if (time(enrollTo) - time(enrollFrom) > 180 * DAY_MS) {
        const fixed = `${enrollTo.slice(0, 4)}${enrollFrom.slice(4)}`;
        if (time(fixed) <= time(enrollTo)) {
          warn(`inscripción corregida: empezaba el ${parts[3]} (se tomó el año ${enrollTo.slice(0, 4)})`);
          enrollFrom = fixed;
        }
      }
      if (time(enrollFrom) > time(enrollTo)) warn(`la inscripción de '${name}' termina antes de empezar`);
    }
    subject.tables.push({ name, date, kind, enrollFrom, enrollTo });
  });

  return {
    subjects,
    warnings,
    career: filterValue(lines, "Propuesta (*)"),
    plan: filterValue(lines, "Plan"),
  };
}
