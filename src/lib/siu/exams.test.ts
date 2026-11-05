import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSiuExams } from "./exams";

const fixture = (name: string) => readFileSync(new URL(`../../../data/siu/${name}`, import.meta.url), "utf-8");

describe("parseSiuExams with the real Industrial 2023 exam dates", () => {
  const { subjects, warnings, career, plan } = parseSiuExams(fixture("examenes_industrial-2023.txt"));
  const tables = subjects.flatMap((s) => s.tables);

  it("reads every subject and exam table, skipping the page menu and the search form", () => {
    expect(subjects).toHaveLength(26);
    expect(tables).toHaveLength(131);
    expect(tables.filter((t) => t.kind === "Libre")).toHaveLength(15);
  });

  it("reads the filters chosen in the SIU", () => {
    expect(career).toBe("Ingeniería Industrial");
    expect(plan).toBe("2023");
  });

  it("turns dates into ISO strings", () => {
    const economia = subjects.find((s) => s.code === "TC010")!;
    expect(economia.name).toBe("ECONOMÍA");
    expect(economia.tables[0]).toEqual({
      name: "Mesa 1 Surace",
      date: "2026-12-11",
      kind: "Regular",
      enrollFrom: "2026-11-16T08:00",
      enrollTo: "2026-12-09T23:59",
      startTime: null,
      endTime: null,
      room: null,
      dropUntil: null,
      teachers: null,
    });
  });

  it("keeps codes with letters and dashes", () => {
    expect(subjects.map((s) => s.code)).toContain("RID-2023");
    expect(subjects.map((s) => s.code)).toContain("PPS-ID-2023");
  });

  it("fixes the year typo in enrollment starts and warns about windows that end before they start", () => {
    const transformacion = subjects.find((s) => s.code === "TB017")!;
    const feb = transformacion.tables.find((t) => t.date === "2027-02-04")!;
    expect(feb.enrollFrom).toBe("2027-01-27T18:00");
    expect(warnings.some((w) => w.includes("inscripción corregida"))).toBe(true);
    for (const w of warnings) expect(w).toMatch(/inscripción corregida|termina antes de empezar/);
  });
});

describe("parseSiuExams rules", () => {
  it("returns nothing for a text that is not from the SIU", () => {
    expect(parseSiuExams("hola")).toEqual({ subjects: [], warnings: [], career: null, plan: null });
  });

  it("warns about unknown lines after the first subject", () => {
    const { warnings } = parseSiuExams(["ECONOMÍA (TC010)", "algo raro"].join("\n"));
    expect(warnings).toEqual(["línea 2: no reconocida 'algo raro'"]);
  });
});
