import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commissionKey, offeringKey, previewImport, sameLead, termFromPeriodo } from "./offer-import";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf-8");
// Plan subjects as they would come from the database (ids are made up).
const plan = (file: string) =>
  (JSON.parse(read(`data/planes/${file}`)) as { materia: string }[]).map((m, i) => ({ id: i + 1, name: m.materia }));

describe("previewImport", () => {
  const industrialPlan = plan("industrial-2020.json");
  const industrial = previewImport(read("data/siu/industrial-2023_2C2026.txt"), industrialPlan, new Map());

  it("keeps the subjects of the plan and lists the rest as not in the plan", () => {
    expect(industrial.preview.format).toBe("detail");
    expect(industrial.preview.periodo).toBe("2026 - 2do Cuatrimestre");
    expect(industrial.preview.stats).toEqual({ subjects: 54, courses: 185, blocks: 423 });
    expect(industrial.preview.unmatched.map((u) => u.siuCode)).toContain("TA018"); // Tesis: not a subject of the map
    expect(industrial.preview.matched).toHaveLength(54);
    expect(industrial.drafts).toHaveLength(185);
  });

  it("builds offering rows with weekday, minutes and campus codes", () => {
    const draft = industrial.drafts.find((d) => d.siu_subject_code === "CB002" && d.practice === "A" && d.course_number === "01")!;
    expect(draft).toMatchObject({
      siu_subject_name: "ÁLGEBRA LINEAL",
      label: "Curso 1 · práctica A",
      modality: "Promoción",
      quota: 63,
      enrolled: 76,
    });
    expect(draft.subjectId).toBe(industrialPlan.find((s) => s.name === "Álgebra Lineal")!.id);
    expect(draft.blocks[0]).toEqual({
      weekday: 1,
      starts_at: 540,
      ends_at: 660,
      class_type: "Teórica",
      room: "403 - PC",
      campus: "PC",
      is_async: false,
    });
  });

  it("uses known SIU codes before names", () => {
    const fake = { id: 999, name: "Una materia con otro nombre" };
    const { preview } = previewImport(read("data/siu/industrial-2023_2C2026.txt"), [...industrialPlan, fake], new Map([["TA018", 999]]));
    expect(preview.matched.find((m) => m.siuCode === "TA018")?.subjectId).toBe(999);
  });

  it("reads the public table too", () => {
    const { preview, drafts } = previewImport(read("data/siu/civil_2C2026_tabla-publica.txt"), plan("civil-2020.json"), new Map());
    expect(preview.format).toBe("public-table");
    expect(preview.stats).toEqual({ subjects: 78, courses: 168, blocks: 352 });
    expect(drafts.every((d) => d.practice === null && d.modality === null)).toBe(true);
  });

  it("returns nothing for a text that is not from the SIU", () => {
    const { preview, drafts } = previewImport("hola", industrialPlan, new Map());
    expect(preview.format).toBeNull();
    expect(preview.stats).toEqual({ subjects: 0, courses: 0, blocks: 0 });
    expect(drafts).toEqual([]);
  });
});

describe("course identity helpers", () => {
  it("groups the practices of a commission", () => {
    const a = { siu_subject_code: "CB002", course_number: "01", label: "Curso 1 · práctica A" };
    const b = { siu_subject_code: "CB002", course_number: "01", label: "Curso 1 · práctica B" };
    expect(commissionKey(a)).toBe(commissionKey(b));
    expect(commissionKey({ ...a, course_number: "02" })).not.toBe(commissionKey(a));
  });

  it("identifies the same offering row when an offer is replaced", () => {
    const row = { siu_subject_code: "CB002", course_number: "01", practice: "A" };
    expect(offeringKey(row)).toBe(offeringKey({ ...row }));
    expect(offeringKey({ ...row, practice: "B" })).not.toBe(offeringKey(row));
    expect(offeringKey({ ...row, practice: null })).not.toBe(offeringKey(row));
    // A replaced text gives the same keys for the courses that did not change.
    const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf-8");
    const subjects = plan("industrial-2020.json");
    const first = previewImport(read("data/siu/industrial-2023_2C2026.txt"), subjects, new Map()).drafts.map(offeringKey);
    const again = previewImport(read("data/siu/industrial-2023_2C2026.txt"), subjects, new Map()).drafts.map(offeringKey);
    expect(new Set(first).size).toBe(first.length); // no two rows share a key
    expect(again).toEqual(first);
  });

  it("treats a surname and a full name as the same lead", () => {
    expect(sameLead("VARGAS", "VARGAS GABRIELA")).toBe(true);
    expect(sameLead("VARGAS GABRIELA", "VARGAS GABRIELA")).toBe(true);
    expect(sameLead("VARGAS", "VARGASSO")).toBe(false);
    expect(sameLead("", "VARGAS")).toBe(false);
  });

  it("reads the term from the SIU period", () => {
    expect(termFromPeriodo("2026 - 2do Cuatrimestre")).toEqual({ year: 2026, half: 2 });
    expect(termFromPeriodo("2027 - 1er Cuatrimestre")).toEqual({ year: 2027, half: 1 });
    expect(termFromPeriodo(null)).toBeNull();
  });
});
