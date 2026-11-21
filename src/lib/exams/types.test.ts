import { describe, expect, it } from "vitest";
import { enrollmentStatus, formatEnrollMoment, formatExamDay, formatExamTime, formatTeachers, searchSubjects } from "./types";

describe("searchSubjects", () => {
  const subjects = [
    { name: "Análisis Matemático II", code: "CB002" },
    { name: "Álgebra Lineal", code: "CB005" },
    { name: "Química", code: "TC010" },
  ];
  const names = (query: string) => searchSubjects(subjects, query).map((s) => s.name);

  it("keeps every subject with an empty query", () => {
    expect(searchSubjects(subjects, "")).toBe(subjects);
    expect(searchSubjects(subjects, "   ")).toBe(subjects);
  });

  it("ignores accents and case", () => {
    expect(names("analisis")).toEqual(["Análisis Matemático II"]);
    expect(names("ÁLGEBRA")).toEqual(["Álgebra Lineal"]);
  });

  it("matches teachers and table names, keeping only those tables", () => {
    const withTables = [
      {
        name: "Higiene y Seguridad",
        code: "TC003",
        tables: [
          { name: "01 MARENSI", teachers: "MARENSI PATRICIO HECTOR (Profesor/a)" },
          { name: "MESA 02", teachers: "RIZZO ELISABETH AMALIA (Profesor/a Adjunto/a)" },
        ],
      },
      { name: "Física II", code: "CB003", tables: [{ name: "MESA 01", teachers: "SURACE PABLO (Profesor/a)" }] },
    ];
    const found = (q: string) => searchSubjects(withTables, q).map((s) => [s.name, s.tables.length]);
    expect(found("marensi")).toEqual([["Higiene y Seguridad", 1]]);
    expect(found("rizzo higiene")).toEqual([["Higiene y Seguridad", 1]]);
    expect(found("higiene")).toEqual([["Higiene y Seguridad", 2]]);
    expect(found("surace")).toEqual([["Física II", 1]]);
    expect(found("marensi fisica")).toEqual([]);
  });

  it("matches every word in any order", () => {
    expect(names("ii analisis")).toEqual(["Análisis Matemático II"]);
    expect(names("analisis lineal")).toEqual([]);
  });

  it("finds subjects by their SIU code", () => {
    expect(names("tc010")).toEqual(["Química"]);
    expect(names("cb00")).toEqual(["Análisis Matemático II", "Álgebra Lineal"]);
  });
});

describe("enrollmentStatus", () => {
  const table = { enrollFrom: "2026-11-30T14:00", enrollTo: "2026-12-07T14:00" };

  it("is open between the start and the end", () => {
    expect(enrollmentStatus(table, "2026-12-01T10:00")).toEqual({ kind: "open", until: "2026-12-07T14:00" });
    expect(enrollmentStatus(table, "2026-12-07T14:00")).toEqual({ kind: "open", until: "2026-12-07T14:00" });
  });

  it("is coming before the start and closed after the end", () => {
    expect(enrollmentStatus(table, "2026-11-30T13:59")).toEqual({ kind: "soon", from: "2026-11-30T14:00" });
    expect(enrollmentStatus(table, "2026-12-07T14:01")).toEqual({ kind: "closed" });
  });

  it("is unknown without an end, and open without a start", () => {
    expect(enrollmentStatus({ enrollFrom: null, enrollTo: null }, "2026-12-01T10:00")).toEqual({ kind: "unknown" });
    expect(enrollmentStatus({ enrollFrom: null, enrollTo: "2026-12-07T14:00" }, "2026-12-01T10:00").kind).toBe("open");
  });
});

describe("formats", () => {
  it("writes exam days with the weekday", () => {
    expect(formatExamDay("2026-12-09")).toBe("Mié 9/12");
    expect(formatExamDay("2027-02-04")).toBe("Jue 4/2");
  });

  it("drops midnight times from enrollment moments", () => {
    expect(formatEnrollMoment("2026-12-07T14:00")).toBe("7/12 14:00");
    expect(formatEnrollMoment("2026-12-07T23:59")).toBe("7/12");
    expect(formatEnrollMoment("2026-11-16T00:00")).toBe("16/11");
  });

  it("writes the exam time with its end when the SIU gives it", () => {
    expect(formatExamTime("17:00", null)).toBe("17:00");
    expect(formatExamTime("17:00", "20:00")).toBe("17:00 a 20:00");
    expect(formatExamTime(null, "20:00")).toBeNull();
  });

  it("keeps the surnames of the examiners, without the department authorities", () => {
    expect(formatTeachers("SURACE PABLO ESTEBAN (Profesor/a)")).toBe("Surace");
    expect(
      formatTeachers(
        "ORECCHIA MONICA INES (Profesor/a), DE LA FUENTE ANA (Profesor/a (supl)), VARGAS GABRIELA (Secretario/a Departamento), GRYNBERG SEBASTIAN PABLO (Director/a Departamento)",
      ),
    ).toBe("Orecchia, De la Fuente");
    expect(formatTeachers("VARGAS GABRIELA (Secretario/a Departamento)")).toBe("Vargas");
    expect(formatTeachers(null)).toBeNull();
  });
});
