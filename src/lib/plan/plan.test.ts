import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSiuOffer } from "../siu/parser";
import { analyzePlan } from "./analyze";
import { courseOptions, type CourseOption } from "./options";

const text = readFileSync(new URL("../../../data/siu/industrial-2023_2C2026.txt", import.meta.url), "utf-8");
const { offer } = parseSiuOffer(text);
const all = offer.materias.flatMap(courseOptions);
const byId = (id: string): CourseOption => {
  const option = all.find((o) => o.id === id);
  if (!option) throw new Error(`No existe la opción ${id}`);
  return option;
};
const hhmm = (h: number, m = 0) => h * 60 + m;

describe("courseOptions with the real Industrial 2C 2026 offer", () => {
  it("skips CONDICIONALES and 'i' copies, and splits courses by practice group", () => {
    expect(all).toHaveLength(196);
    expect(all.some((o) => o.id.endsWith("i"))).toBe(false);
    const algebra = all.filter((o) => o.subjectCode === "CB002").map((o) => o.id);
    expect(algebra.slice(0, 2)).toEqual(["CB002-01A", "CB002-01B"]);
  });

  it("combines the shared lectures with each practice group", () => {
    const o = byId("CB002-01A");
    expect(o.label).toBe("Curso 01 · práctica A");
    expect(o.modality).toBe("Promoción");
    expect(o.quota).toBe(63);
    expect(o.teachers.map((t) => t.nombre)).toEqual([
      "VARGAS GABRIELA",
      "TORLASCO FLORENCIA ALEJANDRA",
      "JALIFE MICAELA",
    ]);
    expect(o.blocks.map((b) => [b.day, b.start, b.end, b.type])).toEqual([
      ["Lunes", hhmm(9), hhmm(11), "Teórica"],
      ["Miércoles", hhmm(9), hhmm(11), "Teórica"],
      ["Lunes", hhmm(11), hhmm(13), "Práctica"],
      ["Miércoles", hhmm(11), hhmm(13), "Práctica"],
    ]);
  });

  it("finds the lectures even when the SIU misspells their name", () => {
    // "CURS 03 - MOREY" and "CURSO 12- CENTENO" are lectures, not practice groups.
    expect(all.filter((o) => o.id.startsWith("TA010-03")).map((o) => o.id)).toEqual(["TA010-03A", "TA010-03B"]);
    expect(all.filter((o) => o.id.startsWith("CB001-12")).map((o) => o.id)).toEqual(["CB001-12A", "CB001-12B"]);
  });

  it("marks asynchronous classes and drops the campus of virtual ones", () => {
    expect(byId("CB040-01").blocks.some((b) => b.async)).toBe(true);
    const remote = byId("CB004-10").blocks;
    expect(remote.every((b) => b.room === "Clase Virtual-PC" && b.campus === null)).toBe(true);
  });
});

describe("analyzePlan", () => {
  it("reports an overlap with its exact time", () => {
    // Agroindustria (Jue 17–19) and Álgebra curso 02 (práctica Jue 16–18).
    const r = analyzePlan([{ option: byId("TA030-01") }, { option: byId("CB002-02A") }]);
    expect(r.overlaps).toEqual([
      { day: "Jueves", start: hhmm(17), end: hhmm(18), courseIds: ["CB002-02A", "TA030-01"] },
    ]);
  });

  it("reports a rushed trip between campuses", () => {
    // Electricidad y Magnetismo ends Thursday 17:00 in Paseo Colón; Agroindustria starts 17:00 in Las Heras.
    const r = analyzePlan([{ option: byId("TA030-01") }, { option: byId("CB022-03") }]);
    expect(r.overlaps).toEqual([]);
    expect(r.rushedTransfers).toEqual([
      {
        day: "Jueves",
        from: "Paseo Colón",
        to: "Las Heras",
        leaveAt: hhmm(17),
        arriveAt: hhmm(17),
        courseIds: ["CB022-03", "TA030-01"],
      },
    ]);
  });

  it("keeps asynchronous classes out of the grid and the warnings", () => {
    const quimica = byId("CB040-01");
    const asyncBlock = quimica.blocks.find((b) => b.async)!;
    const r = analyzePlan([{ option: quimica, credits: 6 }]);
    expect(r.asyncClasses).toEqual([{ courseId: "CB040-01", block: asyncBlock }]);
    expect(r.asyncMinutes).toBe(asyncBlock.end - asyncBlock.start);
    const inPerson = quimica.blocks.filter((b) => !b.async);
    expect(r.weeklyMinutes).toBe(inPerson.reduce((s, b) => s + b.end - b.start, 0));
  });

  it("adds up subjects, credits and hours", () => {
    const r = analyzePlan([
      { option: byId("CB002-01A"), credits: 6 },
      { option: byId("TA030-01"), credits: 4 },
    ]);
    expect(r).toMatchObject({ subjects: 2, credits: 10, weeklyMinutes: hhmm(8) + hhmm(2) });
    expect(r.overlaps).toEqual([]);
    expect(r.rushedTransfers).toEqual([]);
  });

  it("ignores trips with an hour or more, and virtual classes", () => {
    const at = (start: number, end: number, campus: CourseOption["blocks"][number]["campus"], id: string): CourseOption => ({
      ...byId("TA030-01"),
      id,
      subjectCode: id,
      blocks: [{ day: "Lunes", start, end, type: "Teórica", room: null, campus, async: false }],
    });
    const r = analyzePlan([
      { option: at(hhmm(9), hhmm(11), "Paseo Colón", "A") },
      { option: at(hhmm(12), hhmm(14), "Las Heras", "B") },
      { option: at(hhmm(14), hhmm(16), null, "C") },
      { option: at(hhmm(16), hhmm(18), "Paseo Colón", "D") },
    ]);
    expect(r.rushedTransfers).toEqual([]);
  });
});
