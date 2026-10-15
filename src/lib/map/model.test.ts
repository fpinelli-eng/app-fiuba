import { describe, expect, it } from "vitest";
import plan from "../../../data/planes/industrial-2020.json";
import areasFile from "../../../data/planes/areas.json";
import {
  CareerMap,
  electiveTarget,
  formatAverage,
  normalizeText,
  requirementKey,
  subjectKey,
  type Progress,
  type Subject,
  type SubjectKind,
  type SubjectStatus,
} from "./model";

// Industrial 2023 as the seed loads it (tools/plans-seed/build.mjs).
const KINDS: Record<string, SubjectKind> = {
  "*CBC": "cbc_subject",
  CBC: "cbc",
  "Materias Obligatorias": "required",
  "Materias Electivas": "elective",
  "Fin de Carrera (Obligatorio)": "final_project",
  "Fin de Carrera": "final_option",
};
type Row = { id: string; materia: string; creditos: number; categoria: string; level?: number; correlativas?: string; requiere?: number; requiereCBC?: boolean };
const rows = plan as Row[];
const idOf = new Map(rows.map((r, i) => [r.id, i + 1]));
const subjects: Subject[] = rows.map((r, i) => ({
  id: i + 1,
  code: r.id,
  name: r.materia,
  credits: r.creditos,
  kind: KINDS[r.categoria] ?? "orientation",
  category: r.categoria,
  level: r.level ?? null,
  requiredCredits: r.requiere ?? null,
  requiresCbc: r.requiereCBC === true,
  prerequisites: (r.correlativas ?? "").split("-").filter(Boolean).map((c) => idOf.get(c)!),
  sort: i,
  area: null,
}));
const english = { id: 1, name: "Prueba de nivel de idioma inglés", shortName: "Inglés" };
const map = new CareerMap(subjects, [english]);
const id = (code: string) => idOf.get(code)!;

function progress(entries: [string, SubjectStatus, number?][] = [], requirements: number[] = []): Progress {
  return {
    subjects: new Map(entries.map(([code, status, grade]) => [id(code), { status, grade: grade ?? null }])),
    requirements: new Set(requirements),
  };
}
const CBC: [string, SubjectStatus, number][] = [
  ["CBC66", "approved", 8],
  ["CBC62", "approved", 7],
  ["CBC24", "approved", 9],
  ["CBC3", "approved", 7],
  ["CBC90", "approved", 8],
  ["CBC40", "approved", 8],
];

describe("display state", () => {
  it("blocks everything after the CBC until the CBC is complete", () => {
    const p = progress(CBC.slice(0, 5));
    expect(map.cbcComplete(p)).toBe(false);
    expect(map.displayState(p, id("CBC40"))).toBe("enabled");
    expect(map.displayState(p, id("AMII"))).toBe("blocked");
  });

  it("enables subjects whose prerequisites are approved", () => {
    const p = progress(CBC);
    expect(map.displayState(p, id("AMII"))).toBe("enabled");
    expect(map.displayState(p, id("ERM"))).toBe("blocked"); // needs AMII and FSP
    const p2 = progress([...CBC, ["AMII", "approved", 8], ["FSP", "final_pending"]]);
    expect(map.displayState(p2, id("ERM"))).toBe("blocked"); // a pending final is not enough
    expect(map.displayState(p2, id("FSP"))).toBe("final_pending");
  });

  it("checks required credits and the complete CBC", () => {
    // IASCP needs 100 credits and the CBC.
    expect(map.displayState(progress(CBC), id("IASCP"))).toBe("blocked");
    const many = progress([...CBC, ["AMII", "approved", 8], ["FSP", "approved", 7], ["PII", "approved", 9], ["QB", "approved", 7], ["AL", "approved", 8], ["ERM", "approved", 7], ["ODE", "approved", 9], ["PROBA", "approved", 8], ["ECO", "approved", 8], ["TDE", "approved", 7]]);
    expect(map.approvedCredits(many)).toBeGreaterThanOrEqual(100);
    expect(map.displayState(many, id("IASCP"))).toBe("enabled");
  });
});

describe("credits and average", () => {
  it("counts approved credits including the CBC, and averages grades", () => {
    const p = progress([...CBC, ["AMII", "approved", 10], ["FSP", "in_progress"]]);
    expect(map.approvedCredits(p)).toBe(38 + 8);
    expect(formatAverage(map.average(p))).toBe("8,14");
    expect(formatAverage(map.average(progress()))).toBe("—");
  });

  it("counts elective credits apart", () => {
    const elective = subjects.find((s) => s.kind === "elective")!;
    const p: Progress = { subjects: new Map([[elective.id, { status: "approved", grade: 9 }]]), requirements: new Set() };
    expect(map.electiveCredits(p)).toBe(elective.credits);
  });
});

describe("home", () => {
  it("adds credits by category", () => {
    const p = progress([...CBC, ["AMII", "approved", 8], ["AL", "final_pending"]]);
    const c = map.creditsByCategory(p, { total: 236, electivas: 24 });
    expect(c.cbc).toEqual({ done: 38, total: 38 });
    expect(c.required.done).toBe(8);
    expect(c.electives).toEqual({ done: 0, total: 24 });
    expect(c.final).toEqual({ done: 0, total: 12 });
    expect(c.cbc.total + c.required.total + 24 + c.final.total).toBe(236);
  });

  it("says what a pending final unlocks, leaving out what is already loaded", () => {
    const p = progress([...CBC, ["AL", "final_pending"], ["PROBA", "approved", 7]]);
    expect(map.unlockSummary(p, id("AL"))).toBe("Destraba Investigación Operativa");
    const p2 = progress([...CBC, ["AL", "final_pending"], ["INVOP", "in_progress"]]);
    expect(map.unlockSummary(p2, id("AL"))).toBe("No destraba otras materias");
  });
});

describe("relations", () => {
  it("expands the CBC node into its subjects", () => {
    expect(map.expandedPrerequisites(id("AMII")).sort()).toEqual(CBC.map(([c]) => id(c)).sort());
  });

  it("lists what a subject unlocks", () => {
    expect(map.unlocks(id("ODE")).map((s) => s.code)).toContain("GICV");
    expect(map.unlockText(id("CBC66"))).toMatch(/^Con el CBC completo: /);
    expect(map.unlockText(id("PROYIND"))).toBe("No es correlativa de ninguna materia");
  });
});

describe("layout", () => {
  const { cbc, terms } = map.columns();

  it("puts the CBC in its own column and one column per term", () => {
    expect(cbc).toHaveLength(6);
    expect(terms.map((t) => t.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(terms[0].items.map((i) => (i.type === "subject" ? i.subject.code : ""))).toEqual(["AMII", "FSP", "PII"]);
  });

  it("puts the final work and the English test in the last column", () => {
    const last = terms[terms.length - 1].items.map((i) => i.key);
    expect(last).toEqual([subjectKey(id("EJPROF")), subjectKey(id("TIF")), requirementKey(1)]);
  });

  it("groups electives by the plan's areas, in order", () => {
    const areas = (areasFile as unknown as Record<string, Record<string, string[]>>)["industrial-2023"];
    const names = Object.keys(areas);
    const withAreas = subjects.map((s) => {
      const i = names.findIndex((n) => areas[n].includes(s.code));
      return i >= 0 ? { ...s, area: { name: names[i], sort: i } } : s;
    });
    const groups = new CareerMap(withAreas, []).electiveGroups();
    expect(groups.map((g) => g.name)).toEqual(names);
    expect(groups[names.indexOf("Energía")].items).toHaveLength(5);
  });

  it("keeps electives out of the map, in the panel", () => {
    const inMap = new Set([...cbc, ...terms.flatMap((t) => t.items)].map((i) => i.key));
    const groups = map.electiveGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBeNull();
    expect(groups[0].items.every((s) => !inMap.has(subjectKey(s.id)))).toBe(true);
  });

  it("loads the CBC first, then column by column", () => {
    const seq = map.loadSequence();
    expect(seq[0]).toBe(subjectKey(id("CBC66")));
    expect(seq[6]).toBe(subjectKey(id("AMII")));
    expect(seq[seq.length - 1]).toBe(requirementKey(1));
  });
});

describe("formatting", () => {
  it("reads the elective target", () => {
    expect(electiveTarget({ electivas: 24 })).toBe("24");
    expect(electiveTarget({ electivas: { tesis: 12, tpp: 18 } })).toBe("12–18");
    expect(electiveTarget({ total: 200 })).toBeNull();
  });

  it("searches without accents", () => {
    expect(normalizeText(" Logística ")).toBe("logistica");
  });
});
