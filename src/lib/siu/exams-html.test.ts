import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSiuExams } from "./exams";
import { decodeEntities, parseSiuExamsHtml, siuMarkup } from "./exams-html";

// The page as the SIU sends it: ISO-8859-1, results inside a script as a JSON string.
const page = readFileSync(new URL("../../../data/siu/examenes_industrial-2023.html", import.meta.url), "latin1");
const copied = readFileSync(new URL("../../../data/siu/examenes_industrial-2023.txt", import.meta.url), "utf-8");

describe("parseSiuExamsHtml with the real Industrial 2023 page", () => {
  const { subjects, warnings, career, plan } = parseSiuExamsHtml(page);
  const tables = subjects.flatMap((s) => s.tables);

  it("reads every subject and exam table", () => {
    expect(subjects).toHaveLength(26);
    expect(tables).toHaveLength(131);
    expect(tables.filter((t) => t.kind === "Libre")).toHaveLength(15);
  });

  it("reads the filters chosen in the SIU, with accents", () => {
    expect(career).toBe("Ingeniería Industrial");
    expect(plan).toBe("2023");
  });

  it("reads the hidden details of each table", () => {
    expect(tables.every((t) => t.startTime && /^\d{2}:\d{2}$/.test(t.startTime))).toBe(true);
    const economia = subjects.find((s) => s.code === "TC010")!;
    expect(economia.name).toBe("ECONOMÍA");
    expect(economia.tables[0]).toEqual({
      name: "Mesa 1 Surace",
      date: "2026-12-11",
      kind: "Regular",
      enrollFrom: "2026-11-16T08:00",
      enrollTo: "2026-12-09T23:59",
      startTime: "17:00",
      endTime: null,
      room: null,
      dropUntil: "2026-12-10T23:59",
      teachers: "SURACE PABLO ESTEBAN (Profesor/a)",
    });
    const algebra = subjects.find((s) => s.code === "CB002")!;
    expect(algebra.tables[0]).toMatchObject({ startTime: "09:00", endTime: "12:00", dropUntil: "2027-03-02T09:00" });
  });

  it("gives the same subjects, tables and warnings as the copied text", () => {
    const fromText = parseSiuExams(copied);
    const strip = (r: typeof fromText) =>
      r.subjects
        .filter((s) => s.tables.length)
        .map((s) => ({
          code: s.code,
          name: s.name,
          tables: s.tables.map(({ name, date, kind, enrollFrom, enrollTo }) => ({ name, date, kind, enrollFrom, enrollTo })),
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
    expect(strip(parseSiuExamsHtml(page))).toEqual(strip(fromText));
    const kinds = (ws: string[]) => ws.map((w) => w.replace(/^[^:]*: /, "")).sort();
    expect(kinds(warnings)).toEqual(kinds(fromText.warnings));
  });
});

describe("parseSiuExamsHtml rules", () => {
  const corte = (rows: string) =>
    `<div class="corte"><div class="encabezado_cuadro"><div class="span12">F&Iacute;SICA I (CB001)</div></div>` +
    `<table><thead><tr><th>Mesa de examen</th><th>Fecha</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const row = (id: string) =>
    `<tr><td>MESA 01</td><td>09/12/2026</td><td>Regular</td><td>30/11/2026 14:00</td><td>07/12/2026 14:00</td>` +
    `<td><a data-id="${id}">Ver</a></td></tr>`;
  const details = (id: string, cells: string[]) =>
    `<tr class="mas_info" id="${id}"><td colspan="6"><table><thead><tr><th>Hora de inicio</th><th>Hora de finalizaci&oacute;n</th>` +
    `<th>Aula</th><th>Fecha tope para bajas</th><th>Docentes</th></tr></thead><tbody><tr>${cells.map((c) => `<td> ${c} </td>`).join("")}</tr></tbody></table></td></tr>`;

  it("reads plain HTML too, decoding entities and taking '-' as empty", () => {
    const { subjects } = parseSiuExamsHtml(corte(row("a") + details("a", ["9:30", "-", "Aula 201 &amp; 202", "-", "-"])));
    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toBe("FÍSICA I");
    expect(subjects[0].tables[0]).toMatchObject({ startTime: "09:30", endTime: null, room: "Aula 201 & 202", dropUntil: null, teachers: null });
  });

  it("matches each details row with its table by id", () => {
    const html = corte(row("a") + row("b") + details("b", ["18:00", "-", "-", "-", "-"]) + details("a", ["09:00", "-", "-", "-", "-"]));
    const [first, second] = parseSiuExamsHtml(html).subjects[0].tables;
    expect([first.startTime, second.startTime]).toEqual(["09:00", "18:00"]);
  });

  it("reads the JSON string the SIU puts inside a script", () => {
    const content = corte(row("a") + details("a", ["17:00", "20:00", "-", "-", "-"]));
    const script = `<script type='text/javascript'>kernel.renderer.on_arrival(${JSON.stringify({ id: "filtro", content }).replace(/\//g, "\\/")});</script>`;
    expect(siuMarkup(`<html>${script}</html>`)).toBe(content);
    expect(parseSiuExamsHtml(script).subjects[0].tables[0]).toMatchObject({ startTime: "17:00", endTime: "20:00" });
  });

  it("returns nothing for a page without results", () => {
    expect(parseSiuExamsHtml("<html><body>hola</body></html>")).toEqual({ subjects: [], warnings: [], career: null, plan: null });
  });

  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Ingenier&iacute;a &#40;&#x41;&#41; &nbsp;&foo;")).toBe("Ingeniería (A)  &foo;");
  });
});
