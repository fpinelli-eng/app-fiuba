// The academic calendar of Novedades (data/calendario/2026-2027.json) against the official PDF
// (Calendario_Academico_2026_2027_81c0faa452_909e52c493.pdf, www.fi.uba.ar/estudiantes/calendario-academico),
// and the migration that loaded it in the database against the JSON.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Row {
  title: string;
  starts_on: string;
  ends_on: string;
  sort: number;
}

const root = process.cwd();
const json: Row[] = JSON.parse(readFileSync(join(root, "data/calendario/2026-2027.json"), "utf8"));
const migration = readFileSync(join(root, "supabase/migrations/20261102150000_news.sql"), "utf8");

const datesOf = (title: string) => json.filter((e) => e.title === title).map((e) => `${e.starts_on} ${e.ends_on}`);

describe("calendar 2026-2027", () => {
  // Read off the PDF, week by week (13 Nov 2026). The PDF marks weeks: each run goes from the
  // Monday of its first week to the Saturday of its last one.
  it("matches rows of the official PDF", () => {
    expect(json).toHaveLength(70);
    expect(datesOf("Período de Clases")).toEqual(["2026-03-09 2026-06-27", "2026-08-17 2026-12-05", "2027-03-08 2027-04-03"]);
    expect(datesOf("Evaluaciones Parciales - 1ra. recuperación")).toEqual(["2026-06-01 2026-06-20", "2026-11-09 2026-11-28"]);
    expect(datesOf("Evaluaciones Integradoras")).toEqual([
      "2026-02-02 2026-03-07",
      "2026-06-29 2026-08-15",
      "2026-12-07 2026-12-19",
      "2027-02-01 2027-03-06",
    ]);
    expect(datesOf("Inscripción para Cursar Asignaturas")).toEqual(["2026-02-23 2026-02-28", "2026-08-03 2026-08-08", "2027-02-22 2027-02-27"]);
    expect(datesOf("Inscripción para Cursos de Verano 2027")).toEqual(["2026-11-09 2026-11-14"]);
    expect(datesOf("Inicio de los Cursos de Verano")).toEqual(["2027-01-04 2027-02-27"]);
    expect(datesOf("Charla de Ingresantes")).toEqual(["2026-03-02 2026-03-07", "2026-08-10 2026-08-15", "2027-03-01 2027-03-06"]);
  });

  it("every run is Monday to Saturday", () => {
    const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    expect(json.filter((e) => weekday(e.starts_on) !== 1 || weekday(e.ends_on) !== 6)).toEqual([]);
  });

  it("the migration loaded exactly the JSON", () => {
    const sql = (s: string) => s.replaceAll("'", "''");
    const rows = [...migration.matchAll(/\('2026-2027', '((?:[^']|'')*)', '([\d-]+)', '([\d-]+)', (\d+)\)/g)].map(
      ([, title, starts, ends, sort]) => `${title}|${starts}|${ends}|${sort}`,
    );
    expect(rows).toEqual(json.map((e) => `${sql(e.title)}|${e.starts_on}|${e.ends_on}|${e.sort}`));
  });
});
