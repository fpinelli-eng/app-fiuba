import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { campusFromRoom, parseSiuOffer, type Offer } from "./parser";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../data/siu/${name}`, import.meta.url), "utf-8");

describe("parseSiuOffer with the real Industrial 2C 2026 offer", () => {
  const { offer, warnings } = parseSiuOffer(fixture("industrial-2023_2C2026.txt"));
  const expected: Offer = JSON.parse(fixture("industrial-2023_2C2026.json"));

  it("matches the Python prototype output exactly", () => {
    expect(offer).toStrictEqual(expected);
  });

  it("finds 61 subjects, 201 courses and 442 schedule blocks", () => {
    const commissions = offer.materias.flatMap((m) => m.comisiones);
    const courses = commissions.filter((c) => !c.es_condicional);
    const blocks = commissions.flatMap((c) => [
      ...c.horarios,
      ...c.subcomisiones.flatMap((s) => s.horarios),
    ]);
    expect(offer.periodo).toBe("2026 - 2do Cuatrimestre");
    expect(offer.materias).toHaveLength(61);
    expect(courses).toHaveLength(201);
    expect(blocks).toHaveLength(442);
  });

  it("only warns about corrected typos", () => {
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) expect(w).toMatch(/^línea \d+: horario corregido /);
  });
});

describe("parseSiuOffer rules", () => {
  const parse = (lines: string[]) => parseSiuOffer(lines.join("\n"));
  const header = ["Período lectivo: 2026 - 2do Cuatrimestre", "Actividad: ÁLGEBRA LINEAL (CB002)"];

  it("reads course number and lead teacher from the commission name", () => {
    const { offer } = parse([...header, "Comisión: CURSO 01i - SABELLI"]);
    const c = offer.materias[0].comisiones[0];
    expect(c.numero).toBe("01i");
    expect(c.docente_en_nombre).toBe("SABELLI");
    expect(c.es_condicional).toBe(false);
  });

  it("marks CONDICIONALES and skips undefined schedules", () => {
    const { offer, warnings } = parse([
      ...header,
      "Comisión: CONDICIONALES - GRYNBERG/ORECCHIA",
      "Cupo / insc.: Sin definir / 0",
      "Tipo de clase\tDía\tHorario\tAula",
      "Sin definir\tSin definir\tSin definir\tAula a determinar",
    ]);
    const c = offer.materias[0].comisiones[0];
    expect(c.es_condicional).toBe(true);
    expect(c.numero).toBeNull();
    expect(c.cupo).toBeNull();
    expect(c.inscriptos).toBe(0);
    expect(c.horarios).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("assigns schedules and teachers to the current subcommission", () => {
    const { offer } = parse([
      ...header,
      "Comisión: CURSO 01 - VARGAS",
      "Instancias: Promoción",
      "Subcomisión: CURSO 01A - VARGAS/TORLASCO",
      "Docentes: TORLASCO FLORENCIA ALEJANDRA (Ayudante 1ro/a), JALIFE MICAELA (Ayudante 2do/a)",
      "Práctica\tLunes\t11:00 a 13:00\t400-PC",
    ]);
    const c = offer.materias[0].comisiones[0];
    expect(c.modalidad).toBe("Promoción");
    expect(c.horarios).toEqual([]);
    expect(c.subcomisiones[0].docentes).toEqual([
      { nombre: "TORLASCO FLORENCIA ALEJANDRA", rol: "Ayudante 1ro/a" },
      { nombre: "JALIFE MICAELA", rol: "Ayudante 2do/a" },
    ]);
    expect(c.subcomisiones[0].horarios).toEqual([
      { tipo: "Práctica", dia: "Lunes", inicio: "11:00", fin: "13:00", aula: "400-PC", sede: "Paseo Colón" },
    ]);
  });

  it("fixes odd minutes but keeps real quarter-hour times", () => {
    const { offer, warnings } = parse([
      ...header,
      "Comisión: CURSO 01 - VARGAS",
      "Práctica\tMiércoles\t11:02 a 13:00\tAula a determinar",
      "Teórica\tJueves\t19:00 a 20:15\t108-LH",
    ]);
    const [typo, real] = offer.materias[0].comisiones[0].horarios;
    expect(typo).toMatchObject({ inicio: "11:00", fin: "13:00", aula: null, sede: null });
    expect(real).toMatchObject({ inicio: "19:00", fin: "20:15", sede: "Las Heras" });
    expect(warnings).toEqual(["línea 4: horario corregido 11:02 a 13:00"]);
  });

  it("warns instead of failing on unexpected input", () => {
    const { warnings } = parse(["Comisión: CURSO 01 - X", ...header, "Comisión: CURSO 01 - X", "Algo raro", "Turno: Mañana", "Aula nueva: 5"]);
    expect(warnings).toEqual([
      "línea 1: comisión antes de cualquier materia",
      "línea 5: no reconocida 'Algo raro'",
      "línea 7: campo desconocido 'Aula nueva'",
    ]);
  });
});

describe("campusFromRoom", () => {
  it.each([
    ["403 - PC", "Paseo Colón"],
    ["108-LH", "Las Heras"],
    ["510 - PC, 200-PC", "Paseo Colón"],
    ["Aula a determinar", null],
  ])("%s → %s", (room, campus) => {
    expect(campusFromRoom(room)).toBe(campus);
  });
});

describe("parseSiuOffer with the public 'Horarios de cursada' table", () => {
  const informatica = parseSiuOffer(fixture("informatica_2C2026_tabla-publica.txt"));
  const civil = parseSiuOffer(fixture("civil_2C2026_tabla-publica.txt"));
  const subject = (code: string) => informatica.offer.materias.find((m) => m.codigo === code)!;

  it("detects each format", () => {
    expect(informatica.format).toBe("public-table");
    expect(parseSiuOffer(fixture("industrial-2023_2C2026.txt")).format).toBe("detail");
    expect(parseSiuOffer("cualquier cosa").format).toBeNull();
  });

  it("reads every row, skipping the page menu and the search form", () => {
    const commissions = informatica.offer.materias.flatMap((m) => m.comisiones);
    expect(informatica.offer.periodo).toBe("2026 - 2do Cuatrimestre");
    expect(informatica.offer.materias).toHaveLength(65);
    expect(commissions).toHaveLength(150);
    expect(commissions.flatMap((c) => c.horarios)).toHaveLength(331);
    expect(informatica.warnings).toEqual(["línea 209: horario corregido 11:02 - 13:00"]);
  });

  it("groups the rows of each commission and reads the lead teacher from its name", () => {
    const c = subject("7547").comisiones[0];
    expect(subject("7547").nombre).toBe("TALLER DE DESARROLLO DE PROYECTOS II");
    expect(c).toMatchObject({ nombre: "CURSO 01 - MOLINARI", numero: "01", docente_en_nombre: "MOLINARI", cupo: 40, es_condicional: false });
    expect(c.horarios).toEqual([
      { tipo: "Teórico Práctica Obligatoria", dia: "Lunes", inicio: "17:00", fin: "23:00", aula: "313-PC", sede: "Paseo Colón" },
    ]);
    expect(subject("CB001").comisiones[0].horarios).toHaveLength(4);
  });

  it("puts accents back on days and splits rooms from campuses", () => {
    const guarna = subject("7556").comisiones[0].horarios;
    expect(guarna.map((h) => h.dia)).toEqual(["Lunes", "Miércoles"]);
    expect(guarna[0]).toMatchObject({ aula: "Clase Virtual-PC", sede: "Paseo Colón" });

    const roca = subject("7574").comisiones[0];
    expect(roca.cupo).toBeNull(); // empty "Cupo" column
    expect(roca.horarios.map((h) => [h.aula, h.sede])).toEqual([
      ["416-PC, 414-PC", "Paseo Colón"],
      ["510 - PC", "Paseo Colón"],
    ]);
    expect(subject("7561").comisiones[0].horarios[0]).toMatchObject({ aula: null, sede: null });
    expect(subject("7801").comisiones[0].horarios[0]).toMatchObject({ aula: null, sede: "Las Heras" });
  });

  it("marks CONDICIONALES", () => {
    const commissions = civil.offer.materias.flatMap((m) => m.comisiones);
    expect(commissions).toHaveLength(186);
    expect(commissions.filter((c) => c.es_condicional)).toHaveLength(2);
  });
});
