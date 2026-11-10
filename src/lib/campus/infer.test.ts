import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSiuOffer } from "../siu/parser";
import { inferCampus, similarity, subjectKey, withCampus, type CampusCode } from "./infer";

const CODE: Record<string, CampusCode> = { "Paseo Colón": "PC", "Las Heras": "LH", "Ciudad Universitaria": "CU" };

/** Every class of a real 2C 2026 offer, with what the SIU says and what inferCampus would say. */
function classes(file: string, planId: string) {
  const { offer } = parseSiuOffer(readFileSync(`data/siu/${file}`, "utf8"));
  const out: { code: string; siu: CampusCode | null; guess: CampusCode | null }[] = [];
  for (const m of offer.materias)
    for (const c of m.comisiones)
      for (const s of [c, ...c.subcomisiones]) {
        const teachers = [...c.docentes, ...s.docentes].map((d) => d.nombre);
        if (c.docente_en_nombre) teachers.push(c.docente_en_nombre);
        const guess = inferCampus({ planId, siuCode: m.codigo, siuName: m.nombre, teachers });
        for (const h of s.horarios) out.push({ code: m.codigo, siu: h.sede ? CODE[h.sede] : null, guess });
      }
  return out;
}

// The numbers Francisco reviewed on 10 Nov 2026 (page "Sedes por materia: revisión del cruce", v2).
const OFFERS = [
  { file: "industrial-2023_2C2026.txt", plan: "industrial-2023", missing: 59, filled: 45, checked: 344, wrong: 0 },
  { file: "informatica_2C2026_tabla-publica.txt", plan: "informatica-2023", missing: 15, filled: 11, checked: 283, wrong: 6 },
  { file: "quimica_2C2026_tabla-publica.txt", plan: "quimica-2023", missing: 80, filled: 66, checked: 247, wrong: 5 },
  // Civil: 2 more than the review, Hidráulica General by its lead (Schifini → Las Heras), as the SIU says.
  { file: "civil_2C2026_tabla-publica.txt", plan: "civil-2023", missing: 53, filled: 18, checked: 130, wrong: 13 },
];

describe("inferCampus on the real offers", () => {
  for (const o of OFFERS) {
    it(`${o.plan}: fills ${o.filled} of ${o.missing} classes without campus`, () => {
      const all = classes(o.file, o.plan);
      const missing = all.filter((c) => !c.siu);
      expect(missing.length).toBe(o.missing);
      expect(missing.filter((c) => c.guess).length).toBe(o.filled);
    });
    it(`${o.plan}: agrees with the SIU where the SIU has a campus`, () => {
      const known = all(o).filter((c) => c.siu && c.guess);
      expect(known.length).toBe(o.checked);
      expect(known.filter((c) => c.guess !== c.siu).length).toBe(o.wrong);
    });
  }
  const all = (o: (typeof OFFERS)[number]) => classes(o.file, o.plan);
});

describe("inferCampus rules", () => {
  const guess = (planId: string, siuCode: string, siuName: string, teachers: string[] = []) =>
    inferCampus({ planId, siuCode, siuName, teachers });

  it("old-plan subjects go by exact code", () => {
    expect(guess("quimica-1986", "7647", "FENOMENOS DE TRANSPORTE")).toBe("CU");
    expect(guess("industrial-2011", "91.28", "GESTION DE COSTOS")).toBe("LH");
    expect(guess("industrial-2011", "9999", "MATERIA QUE NO ESTA")).toBeNull();
  });
  it("picks the campus by teacher when the table says it depends on the course", () => {
    expect(guess("informatica-1986", "7512", "ANALISIS NUMERICO I", ["MENENDEZ JUAN"])).toBe("LH");
    expect(guess("informatica-1986", "7512", "ANALISIS NUMERICO I", ["PEREZ ANA"])).toBe("PC");
    expect(guess("civil-2009", "8901", "HIDRAULICA GENERAL", ["KOUTSOVITIS MARIA"])).toBe("PC");
    expect(guess("civil-2009", "8901", "HIDRAULICA GENERAL", ["OTRO"])).toBeNull();
  });
  it("leaves subjects taught in both campuses without one", () => {
    expect(guess("informatica-1986", "7801", "IDIOMA INGLES")).toBeNull();
  });
  it("new-plan subjects use the official equivalence", () => {
    expect(guess("industrial-2023", "CB040", "QUÍMICA BÁSICA")).toBe("PC"); // 83.01 Química
    expect(guess("industrial-2023", "TB012", "MATERIALES Y APLICACIONES I")).toBe("LH"); // 92.01
    expect(guess("quimica-2023", "TA161", "FENÓMENOS DE TRANSPORTE")).toBe("CU"); // 76.47
  });
  it("no campus when the equivalents are in different campuses", () => {
    expect(guess("industrial-2023", "TB013", "TRANSFORMACIÓN DE LA ENERGÍA")).toBeNull(); // PC + PC + LH
    expect(guess("quimica-2023", "TC027", "EMISIONES DE CONTAMINANTES QUÍMICOS Y BIOLÓGICOS")).toBeNull();
  });
  it("no campus when the equivalence and the name disagree", () => {
    // Equivalence: 63.02 Química I (PC); name: 76.46 Introducción a la Ingeniería Química (CU).
    expect(guess("quimica-2023", "TB087", "INTRODUCCIÓN A INGENIERÍA QUÍMICA")).toBeNull();
  });
  it("without an equivalence, an almost identical name", () => {
    expect(guess("civil-2023", "TA070", "HORMIGÓN I")).toBe("LH"); // 94.01
    expect(guess("industrial-2023", "TA018", "TESIS DE INGENIERÍA INDUSTRIAL")).toBeNull(); // 86 % to Bioingeniería Industrial
  });
});

describe("helpers", () => {
  it("compares names like rapidfuzz's ratio", () => {
    expect(similarity("abc", "abc")).toBe(100);
    expect(Math.round(similarity(subjectKey("Aeropuertos II"), subjectKey("AEROPUERTOS B")))).toBe(89);
  });
  it("withCampus only fills blocks without a campus", () => {
    const blocks: { campus: CampusCode | null; async: boolean; room?: string }[] = [
      { campus: "LH", async: false },
      { campus: null, async: false },
      { campus: null, async: true },
      { campus: null, async: false, room: "Virtual" },
    ];
    const out = withCampus(blocks, { planId: "industrial-2023", siuCode: "CB040", siuName: "QUÍMICA BÁSICA", teachers: [] });
    expect(out.map((b) => b.campus)).toEqual(["LH", "PC", null, null]);
  });
});
