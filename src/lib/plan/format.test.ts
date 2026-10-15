import { describe, expect, it } from "vitest";
import { describeSchedule, formatHour, formatHours, shortTeacherList, surname, titleCase } from "./format";
import type { ClassBlock } from "./options";

const block = (day: ClassBlock["day"], start: number, end: number, extra: Partial<ClassBlock> = {}): ClassBlock => ({
  day,
  start: start * 60,
  end: end * 60,
  type: "Teórica",
  room: "403 - PC",
  campus: "Paseo Colón",
  async: false,
  ...extra,
});

describe("formatHour / formatHours", () => {
  it("writes hours like the design", () => {
    expect(formatHour(18 * 60)).toBe("18");
    expect(formatHour(18 * 60 + 30)).toBe("18:30");
    expect(formatHours(150)).toBe("2,5");
    expect(formatHours(240)).toBe("4");
  });
});

describe("describeSchedule", () => {
  it("joins back-to-back classes and orders days", () => {
    const text = describeSchedule([block("Miércoles", 9, 11), block("Lunes", 11, 13), block("Lunes", 9, 11)]);
    expect(text).toBe("Lun 9–13 hs y Mié 9–11 hs · Paseo Colón");
  });

  it("lists every campus, virtual classes, and skips asynchronous ones", () => {
    const text = describeSchedule([
      block("Martes", 18, 22, { campus: "Las Heras" }),
      block("Jueves", 18, 20, { campus: null, room: "Clase Virtual-PC" }),
      block("Viernes", 20, 22, { async: true }),
    ]);
    expect(text).toBe("Mar 18–22 hs y Jue 18–20 hs · Las Heras / Virtual");
  });

  it("says when the campus is not defined yet", () => {
    expect(describeSchedule([block("Lunes", 9, 11, { campus: null, room: null })])).toBe("Lun 9–11 hs · Sede a confirmar");
  });
});

describe("titleCase", () => {
  it("keeps connectors in lowercase and roman numerals in uppercase", () => {
    expect(titleCase("INTRODUCCIÓN A LA INTELIGENCIA ARTIFICIAL")).toBe("Introducción a la Inteligencia Artificial");
    expect(titleCase("MATERIALES Y APLICACIONES II")).toBe("Materiales y Aplicaciones II");
  });
});

describe("surname", () => {
  it("uses the surnames written in the course names as hints", () => {
    expect(surname("PONCE DE LEON ROBLES FABIAN ARTURO", ["VARGAS", "PONCE DE LEON"])).toBe("Ponce de Leon");
    expect(surname("GOMEZ CIAPPONI LAUTARO", ["VIBRENTIS", "GOMEZ CIAPPONI"])).toBe("Gomez Ciapponi");
  });

  it("falls back to the first word, keeping particles", () => {
    expect(surname("VARGAS GABRIELA", [])).toBe("Vargas");
    expect(surname("DE LA FUENTE ANA", [])).toBe("De la Fuente");
  });
});

describe("shortTeacherList", () => {
  it("shows up to three surnames and +N", () => {
    expect(shortTeacherList(["Vargas", "Torlasco"])).toBe("Vargas, Torlasco");
    expect(shortTeacherList(["A", "B", "C", "D", "E"])).toBe("A, B, C +2");
    expect(shortTeacherList(["A", "A", "B"])).toBe("A, B");
  });
});
