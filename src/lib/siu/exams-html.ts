// Parser for the public "Fechas de examen" page of FIUBA's SIU-Guaraní as the server returns
// it (fetched by its link, see exams-fetch.ts). Unlike the copied text, the page has the hidden
// "Ver" details of each exam table: start and end time, room, drop deadline and teachers.
//
// The results are not plain HTML: the SIU sends each part of the page ("pagelet") as a JSON
// string inside a script, kernel.renderer.on_arrival({..., "content": "<div class=\"corte\">…"}).
// Each subject is a header ("ECONOMÍA (TC010)") followed by a table whose rows alternate the
// visible row (name, date, kind, enrollment start, enrollment end, "Ver") and a hidden
// <tr class="mas_info"> with a nested table of details.

import {
  buildExamTable,
  NO_DETAILS,
  RE_SUBJECT,
  toDateTime,
  type ExamDetails,
  type ExamParseResult,
  type ExamSubject,
  type ExamTable,
} from "./exams";

interface Cell {
  th: boolean;
  html: string;
}

interface Row {
  attrs: string;
  cells: Cell[];
  nested: Table[];
}

interface Table {
  start: number;
  end: number;
  rows: Row[];
}

const RE_TAG = /<(\/?)(table|tr|td|th)\b([^>]*)>/gi;
const RE_JSON_ESCAPE = /\\(u[0-9a-fA-F]{4}|.)/g;
const JSON_ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };

/** Undoes JSON string escaping (quotes, slashes, newlines, unicode escapes), for a payload JSON.parse could not read. */
function unescapeJson(s: string): string {
  return s.replace(RE_JSON_ESCAPE, (_, e: string) =>
    e.length === 5 ? String.fromCharCode(parseInt(e.slice(1), 16)) : (JSON_ESCAPES[e] ?? e),
  );
}

/** The HTML of the page: the content of every pagelet, or the page itself when it has none. */
export function siuMarkup(page: string): string {
  const parts: string[] = [];
  // JSON escapes "/" inside strings, so the first "})</script>" closes the call.
  for (const m of page.matchAll(/on_arrival\(\s*(\{[\s\S]*?\})\s*\)\s*;?\s*<\/script>/g)) {
    try {
      const payload: unknown = JSON.parse(m[1]);
      const content = (payload as { content?: unknown } | null)?.content;
      if (typeof content === "string") parts.push(content);
    } catch {
      parts.push(unescapeJson(m[1]));
    }
  }
  return parts.length ? parts.join("\n") : page;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ordm: "º", ordf: "ª", deg: "°",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] !== "#") return ENTITIES[e] ?? all;
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
  });
}

/** Visible text of a piece of HTML, with spaces collapsed. */
export function htmlText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** The tables of the markup that are not inside another table; nested ones hang from their row. */
function topTables(html: string): Table[] {
  const top: Table[] = [];
  const stack: { table: Table; row: Row | null; cell: { th: boolean; from: number } | null }[] = [];
  for (const m of html.matchAll(RE_TAG)) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const at = m.index;
    const frame = stack.at(-1);
    if (tag === "table") {
      if (!closing) {
        stack.push({ table: { start: at, end: at, rows: [] }, row: null, cell: null });
        continue;
      }
      const done = stack.pop();
      if (!done) continue;
      done.table.end = at + m[0].length;
      const parent = stack.at(-1);
      if (parent) parent.row?.nested.push(done.table);
      else top.push(done.table);
    } else if (!frame) {
      continue;
    } else if (tag === "tr") {
      if (closing) {
        frame.row = null;
      } else {
        frame.row = { attrs: m[3], cells: [], nested: [] };
        frame.table.rows.push(frame.row);
      }
    } else if (!closing) {
      frame.cell = { th: tag === "th", from: at + m[0].length };
    } else if (frame.cell && frame.row) {
      frame.row.cells.push({ th: frame.cell.th, html: html.slice(frame.cell.from, at) });
      frame.cell = null;
    }
  }
  return top;
}

const attr = (attrs: string, name: string): string | null =>
  attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;

const value = (text: string | undefined): string | null => (text && text !== "-" ? text : null);

const toTime = (text: string | null): string | null => {
  const m = text?.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};

const normalizeLabel = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const DETAIL_COLUMNS = ["hora de inicio", "hora de finalizacion", "aula", "fecha tope para bajas", "docentes"];

/** The "Ver" details from the nested table of a mas_info row (by column title, else by position). */
function readDetails(table: Table | undefined): ExamDetails {
  if (!table) return NO_DETAILS;
  const header = table.rows.find((r) => r.cells.length > 0 && r.cells.every((c) => c.th));
  const data = table.rows.find((r) => r.cells.some((c) => !c.th));
  if (!data) return NO_DETAILS;
  const labels = header ? header.cells.map((c) => normalizeLabel(htmlText(c.html))) : DETAIL_COLUMNS;
  const cells = data.cells.map((c) => htmlText(c.html));
  const get = (label: string) => {
    const i = labels.indexOf(label);
    return value(cells[i >= 0 ? i : DETAIL_COLUMNS.indexOf(label)]);
  };
  const drop = get("fecha tope para bajas");
  return {
    startTime: toTime(get("hora de inicio")),
    endTime: toTime(get("hora de finalizacion")),
    room: get("aula"),
    dropUntil: drop ? toDateTime(drop) : null,
    teachers: get("docentes"),
  };
}

/** The option chosen in a filter of the search form, unless it is a placeholder ("-- Todos --"). */
function selectedFilter(html: string, field: string): string | null {
  const select = html.match(new RegExp(`<select[^>]*name=["']formulario_filtro\\[${field}\\]["'][^>]*>([\\s\\S]*?)</select>`, "i"));
  const option = select?.[1].match(/<option[^>]*\bselected\b[^>]*>([\s\S]*?)<\/option>/i);
  const text = option ? htmlText(option[1]) : "";
  return !text || text.startsWith("--") ? null : text;
}

/** The subject header ("ECONOMÍA (TC010)") right before a table, if any. */
function subjectBefore(html: string): ExamSubject | null {
  const i = html.lastIndexOf("encabezado_cuadro");
  const text = htmlText(i >= 0 ? html.slice(html.lastIndexOf("<", i)) : html);
  const m = text.match(RE_SUBJECT);
  return m ? { code: m[2], name: m[1].trim(), tables: [] } : null;
}

export function parseSiuExamsHtml(page: string): ExamParseResult {
  const html = siuMarkup(page);
  const subjects: ExamSubject[] = [];
  const warnings: string[] = [];

  let previousEnd = 0;
  for (const table of topTables(html)) {
    const subject = subjectBefore(html.slice(previousEnd, table.start));
    previousEnd = table.end;
    const rows = table.rows.filter((r) => r.cells.some((c) => !c.th));
    if (!subject) {
      if (rows.some((r) => buildExamTable(r.cells.map((c) => htmlText(c.html)), NO_DETAILS, () => {}))) {
        warnings.push("hay mesas sin el nombre de la materia arriba: no se tomaron");
      }
      continue;
    }
    const warn = (msg: string) => warnings.push(`${subject.code}: ${msg}`);
    const byId = new Map<string, ExamTable>();
    let last: ExamTable | null = null;

    for (const row of rows) {
      if (/\bmas_info\b/.test(attr(row.attrs, "class") ?? "")) {
        const target = byId.get(attr(row.attrs, "id") ?? "") ?? last;
        if (target) Object.assign(target, readDetails(row.nested[0]));
        continue;
      }
      const parts = row.cells.map((c) => htmlText(c.html));
      const exam = buildExamTable(parts, NO_DETAILS, warn);
      if (!exam) {
        warn(`fila no reconocida '${Array.from(parts.join(" ")).slice(0, 60).join("")}'`);
        continue;
      }
      subject.tables.push(exam);
      last = exam;
      const id = row.cells.map((c) => c.html.match(/data-id=["']([^"']+)["']/)?.[1]).find(Boolean);
      if (id) byId.set(id, exam);
    }
    if (subject.tables.length) subjects.push(subject);
  }

  return {
    subjects,
    warnings,
    career: selectedFilter(html, "carrera"),
    plan: selectedFilter(html, "plan"),
  };
}
