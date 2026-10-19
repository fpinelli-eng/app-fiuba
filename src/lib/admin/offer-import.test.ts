import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commissionKey, decisionFor, detectCourseChanges, offeringKey, previewImport, sameLead, termFromPeriodo } from "./offer-import";

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

describe("detectCourseChanges", () => {
  const draft = (number: string, teachers: string[], practice: string | null = null) => ({
    subjectId: 7,
    siu_subject_code: "CB002",
    siu_subject_name: "ÁLGEBRA LINEAL",
    course_number: number,
    practice,
    label: practice ? `Curso ${Number(number)} · práctica ${practice}` : `Curso ${Number(number)}`,
    modality: null,
    teachers: teachers.map((nombre) => ({ nombre, rol: "" })),
    quota: null,
    enrolled: null,
    blocks: [],
  });
  const before = (courseId: number, number: string, teachers: string[], termId = "2026-2C") => ({
    courseId,
    termId,
    siuCode: "CB002",
    courseNumber: number,
    label: `Curso ${Number(number)}`,
    teachers: teachers.map((nombre) => ({ nombre })),
  });
  const names = new Map([[7, "Álgebra Lineal"]]);
  const detect = (drafts: ReturnType<typeof draft>[], previous: ReturnType<typeof before>[]) =>
    detectCourseChanges(drafts, previous, "2027-1C", names);

  it("asks nothing when number and lead teacher are the same (also surname vs full name)", () => {
    expect(detect([draft("01", ["VARGAS"])], [before(10, "01", ["VARGAS GABRIELA", "TORLASCO ANA"])])).toEqual([]);
  });

  it("asks nothing for a subject never offered before", () => {
    expect(detect([draft("01", ["VARGAS"])], [])).toEqual([]);
  });

  it("suggests the same course when the lead changes but a teacher stays", () => {
    const [c] = detect([draft("01", ["TORLASCO ANA", "JALIFE MICAELA"])], [before(10, "01", ["VARGAS GABRIELA", "TORLASCO ANA"])]);
    expect(c).toMatchObject({ key: "CB002|01", subjectName: "Álgebra Lineal", label: "Curso 1", suggestion: { kind: "same", courseId: 10 } });
    expect(c.reason).toMatch(/^Cambió el titular/);
    expect(c.candidates.map((x) => x.courseId)).toEqual([10]);
  });

  it("suggests a new course when the lead and every teacher change", () => {
    const [c] = detect([draft("01", ["PEREZ JUAN"])], [before(10, "01", ["VARGAS GABRIELA"])]);
    expect(c.suggestion).toEqual({ kind: "new" });
    expect(c.candidates.map((x) => x.courseId)).toEqual([10]); // still offered
  });

  it("follows the lead teacher when the number changes", () => {
    const [c] = detect([draft("05", ["VARGAS"])], [before(10, "01", ["VARGAS GABRIELA"]), before(11, "02", ["LOPEZ"])]);
    expect(c.reason).toBe("Cambió el número: antes Curso 1");
    expect(c.suggestion).toEqual({ kind: "same", courseId: 10 });
  });

  it("lists new courses, offering earlier ones that share a teacher", () => {
    const [shared] = detect([draft("07", ["NUEVO", "TORLASCO"])], [before(10, "01", ["VARGAS", "TORLASCO ANA"])]);
    expect(shared).toMatchObject({ reason: "Curso nuevo que comparte docentes con uno anterior", suggestion: { kind: "new" } });
    expect(shared.candidates.map((x) => x.courseId)).toEqual([10]);
    const [alone] = detect([draft("08", ["NADIE"])], [before(10, "01", ["VARGAS"])]);
    expect(alone).toMatchObject({ reason: "Curso nuevo", candidates: [] });
  });

  it("compares with the latest earlier term only, once per commission", () => {
    const changes = detect(
      [draft("01", ["TORLASCO"], "A"), draft("01", ["TORLASCO"], "B")],
      [before(9, "01", ["TORLASCO"], "2026-1C"), before(10, "01", ["VARGAS", "TORLASCO"])],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].suggestion).toEqual({ kind: "same", courseId: 10 });
    expect(changes[0].candidates.every((c) => c.term === "2C 2026")).toBe(true);
  });

  it("uses the admin's decision over the suggestion", () => {
    const changes = detect([draft("01", ["PEREZ"])], [before(10, "01", ["VARGAS"])]);
    expect(decisionFor({ changes }, "CB002|01")).toEqual({ kind: "new" });
    expect(decisionFor({ changes, decisions: { "CB002|01": { kind: "same", courseId: 10 } } }, "CB002|01")).toEqual({ kind: "same", courseId: 10 });
    expect(decisionFor({ changes }, "otra")).toBeNull();
  });
});
