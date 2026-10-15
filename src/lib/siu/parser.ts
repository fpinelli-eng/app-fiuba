// Parser for the public class schedule page of FIUBA's SIU-Guaraní
// (guaraniautogestion.fi.uba.ar/g3w/horarios_cursadas).
//
// Input: the page text as copied by the admin. Output: subjects → commissions →
// (subcommissions) → schedule blocks, with the same JSON shape as the Python
// prototype in tools/siu-parser/parser_siu.py, so its output is the test fixture.

export type Campus = "Paseo Colón" | "Las Heras" | "Ciudad Universitaria";

export interface Teacher {
  nombre: string;
  rol: string;
}

export interface ScheduleBlock {
  tipo: string;
  dia: string;
  /** "HH:MM", 24 h */
  inicio: string;
  fin: string;
  /** null when the SIU says "Aula a determinar" */
  aula: string | null;
  sede: Campus | null;
}

/** Fields shared by commissions and subcommissions (the units that hold schedules). */
interface Section {
  nombre: string;
  horarios: ScheduleBlock[];
  docentes: Teacher[];
  cupo?: number | null;
  inscriptos?: number | null;
  observaciones?: string;
}

export type Subcommission = Section;

export interface Commission extends Section {
  subcomisiones: Subcommission[];
  /** Course number from "CURSO 02 - APELLIDO": "02", "01i". null for CONDICIONALES. */
  numero: string | null;
  /** Lead teacher's surname as written in the commission name. */
  docente_en_nombre: string | null;
  /** CONDICIONALES commissions have no schedule. */
  es_condicional: boolean;
  /** "Promoción" | "Regularidad" */
  modalidad?: string;
}

export interface Subject {
  codigo: string;
  nombre: string;
  comisiones: Commission[];
}

export interface Offer {
  /** e.g. "2026 - 2do Cuatrimestre" */
  periodo: string | null;
  materias: Subject[];
}

export interface ParseResult {
  offer: Offer;
  /** Human-readable notes for the admin: corrected times, unknown lines, etc. */
  warnings: string[];
}

const DAYS = new Set(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]);
const RE_SUBJECT = /^Actividad: (.+) \(([A-Z0-9]+)\)$/;
const RE_TIME = /^(\d{1,2}):(\d{2}) a (\d{1,2}):(\d{2})$/;
const RE_TEACHER = /([^,(]+?) \(([^)]+)\)/g;
const RE_COURSE = /^CURSO (\w+?)\s*-\s*(.+)$/i;
// Same line breaks as Python's str.splitlines(), so warning line numbers match the prototype.
const RE_LINE_BREAK = /\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/;

const CAMPUS_SUFFIX: Record<string, Campus> = {
  PC: "Paseo Colón",
  LH: "Las Heras",
  CU: "Ciudad Universitaria",
};

/** The room carries the campus as a suffix: "403 - PC" (Paseo Colón), "108-LH" (Las Heras). */
export function campusFromRoom(room: string): Campus | null {
  const m = room.toUpperCase().match(/-\s*(PC|LH|CU)\s*$/);
  return m ? CAMPUS_SUFFIX[m[1]] : null;
}

function parseTeachers(s: string): Teacher[] {
  return [...s.matchAll(RE_TEACHER)].map((m) => ({ nombre: m[1].trim(), rol: m[2].trim() }));
}

function toMinutes(h: string, m: string): number {
  return Number(h) * 60 + Number(m);
}

function formatMinutes(t: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

// The SIU has typos like "11:02 a 13:00". Only minutes that are not multiples of 5 are fixed
// (rounded to the quarter hour); "19:00 a 20:15" is a real schedule.
function fixTypo(t: number): number {
  return t % 5 ? Math.round(t / 15) * 15 : t;
}

function parseCount(s: string): number | null {
  return /^\d+$/.test(s) ? Number(s) : null;
}

export function parseSiuOffer(text: string): ParseResult {
  let periodo: string | null = null;
  const materias: Subject[] = [];
  let subject: Subject | null = null;
  let commission: Commission | null = null;
  let section: Section | null = null; // commission or subcommission receiving schedules
  const warnings: string[] = [];

  text.split(RE_LINE_BREAK).forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trimEnd();
    if (!line) return;
    const warn = (msg: string): void => {
      warnings.push(`línea ${lineNo}: ${msg}`);
    };
    const value = () => line.slice(line.indexOf(":") + 1).trim();

    if (line.startsWith("Período lectivo:")) {
      periodo = value();
      return;
    }

    const subjectMatch = line.match(RE_SUBJECT);
    if (subjectMatch) {
      subject = { codigo: subjectMatch[2], nombre: subjectMatch[1].trim(), comisiones: [] };
      materias.push(subject);
      commission = section = null;
      return;
    }

    if (line.startsWith("Comisión:")) {
      if (!subject) return warn("comisión antes de cualquier materia");
      const nombre = value();
      const course = nombre.match(RE_COURSE);
      commission = {
        nombre,
        subcomisiones: [],
        horarios: [],
        docentes: [],
        numero: course ? course[1] : null,
        docente_en_nombre: course ? course[2].trim() : null,
        es_condicional: nombre.toUpperCase().startsWith("CONDICIONALES"),
      };
      subject.comisiones.push(commission);
      section = commission;
      return;
    }

    if (line.startsWith("Subcomisión:")) {
      if (!commission) return warn("subcomisión antes de cualquier comisión");
      const sub: Subcommission = { nombre: value(), horarios: [], docentes: [] };
      commission.subcomisiones.push(sub);
      section = sub;
      return;
    }

    if (line.includes(":") && !line.includes("\t")) {
      const key = line.slice(0, line.indexOf(":")).trim();
      const val = value();
      if (!section || !commission) return warn(`campo '${key}' fuera de una comisión`);
      if (key === "Cupo / insc.") {
        const [cupo = "", insc = ""] = val.split("/").map((x) => x.trim());
        section.cupo = parseCount(cupo);
        section.inscriptos = parseCount(insc);
      } else if (key === "Docentes") {
        section.docentes = parseTeachers(val);
      } else if (key === "Instancias") {
        commission.modalidad = val; // Promoción / Regularidad
      } else if (key === "Observaciones") {
        section.observaciones = val;
      } else if (key === "Turno" || key === "Ubicación") {
        // Always "Sin definir" / "Sede Unica": no information.
      } else {
        warn(`campo desconocido '${key}'`);
      }
      return;
    }

    if (line.startsWith("Tipo de clase")) return;

    const parts = line.split("\t");
    if (parts.length === 4) {
      const [tipo, dia, horario, aula] = parts.map((p) => p.trim());
      if (dia === "Sin definir") return;
      const t = horario.match(RE_TIME);
      if (!DAYS.has(dia) || !t) return warn(`horario no interpretable '${line}'`);
      if (!section) return warn("horario fuera de una comisión");
      const start = toMinutes(t[1], t[2]);
      const end = toMinutes(t[3], t[4]);
      const fixedStart = fixTypo(start);
      const fixedEnd = fixTypo(end);
      if (fixedStart !== start || fixedEnd !== end) warn(`horario corregido ${horario}`);
      section.horarios.push({
        tipo,
        dia,
        inicio: formatMinutes(fixedStart),
        fin: formatMinutes(fixedEnd),
        aula: aula.toLowerCase().includes("determinar") ? null : aula,
        sede: campusFromRoom(aula),
      });
      return;
    }

    warn(`no reconocida '${Array.from(line).slice(0, 60).join("")}'`);
  });

  return { offer: { periodo, materias }, warnings };
}
