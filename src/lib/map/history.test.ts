import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkHistory,
  countFailedExams,
  importItems,
  interpretHistory,
  matchToPlan,
  normalizeCode,
  parseHistoriaAcademica,
  sameCareer,
  summaryText,
  upsertRows,
  type HistoryRow,
  type PlanSubjectRef,
} from "./history";
import { textLines } from "./history-pdf";
import type { SubjectProgress } from "./model";

// Anonymized Historia académica of Ingeniería Industrial (structure of the real PDF, made-up student and dates).
const FIXTURE = readFileSync(new URL("../../../data/siu/historia-academica_anonima.txt", import.meta.url), "utf-8");

const HEADER = ["HISTORIA ACADÉMICA", "Propuesta: Ingeniería Industrial", "Alumno: ESTUDIANTE DE PRUEBA", "1 de 1 03/11/2026 10:00:00", "Actividad Fecha Tipo Nota Resultado"];
const parseRows = (...rows: string[]) => parseHistoriaAcademica([...HEADER, ...rows]);
const outcomeOf = (...rows: string[]) => interpretHistory(parseRows(...rows).rows);

// Industrial 2023 from data/planes (subjects.code is FIUBA Map's id; for the CBC it is the SIU code).
const PLAN: PlanSubjectRef[] = (
  JSON.parse(readFileSync(new URL("../../../data/planes/industrial-2020.json", import.meta.url), "utf-8")) as { id: string; materia: string; categoria: string }[]
).map((s, i) => ({
  id: i + 1,
  code: s.id,
  name: s.materia,
  kind: s.categoria === "CBC" ? "cbc" : s.categoria === "*CBC" ? "cbc_subject" : s.categoria.includes("Electivas") ? "elective" : "required",
}));
const byCode = (code: string) => PLAN.find((s) => s.code === code)!;

describe("parseHistoriaAcademica", () => {
  const parsed = parseHistoriaAcademica(FIXTURE);

  it("reads the header, the career and every row, across pages", () => {
    expect(parsed.hasTitle).toBe(true);
    expect(parsed.hasColumns).toBe(true);
    expect(parsed.career).toBe("Ingeniería Industrial");
    expect(parsed.rows).toHaveLength(34);
    expect(parsed.unparsed).toEqual([]);
    expect(parsed.summary).toEqual({
      rows: 34,
      subjects: 18,
      byType: { exam: 14, regularity: 10, promotion: 0, equivalence: 7, in_progress: 3 },
    });
  });

  it("reads each kind of row", () => {
    expect(parsed.rows[0]).toEqual({ name: "AGROINDUSTRIA Y BIOECONOMÍA", code: "TA030", date: "2026-07-02", type: "exam", grade: "9", result: "approved" });
    const am2 = parsed.rows.filter((r) => r.code === "CB001");
    expect(am2.map((r) => [r.type, r.grade, r.result])).toEqual([
      ["exam", "6", "approved"],
      ["exam", "D", "failed"],
      ["exam", null, "absent"],
      ["regularity", "5", "approved"],
    ]);
    expect(parsed.rows.find((r) => r.code === "TB015")).toEqual({
      name: "ELECTROTECNIA, MÁQUINAS E INSTALACIONES ELÉCTRICAS",
      code: "TB015",
      date: "2026-08-18",
      type: "in_progress",
      grade: null,
      result: null,
    });
  });

  it("squashes double spaces and keeps accents", () => {
    expect(parsed.rows.find((r) => r.code === "CBC62")?.name).toBe("ALGEBRA A");
    expect(parsed.rows.find((r) => r.code === "CB002")?.name).toBe("ÁLGEBRA LINEAL");
  });

  it("accepts the text as a string with CRLF or as lines", () => {
    expect(parseHistoriaAcademica(FIXTURE.replace(/\r?\n/g, "\r\n")).rows).toEqual(parsed.rows);
    expect(parseHistoriaAcademica(FIXTURE.split(/\r?\n/)).rows).toEqual(parsed.rows);
  });

  it("reads Promoción, with or without the accent", () => {
    const { rows } = parseRows("CÁLCULO NUMÉRICO (CB051) 01/12/2025 Promoción 9 Aprobado", "QUÍMICA (CB099) 01/12/2025 Promocion 7 Aprobado");
    expect(rows.map((r) => [r.type, r.grade, r.result])).toEqual([
      ["promotion", "9", "approved"],
      ["promotion", "7", "approved"],
    ]);
  });

  it("joins a name that wraps before the date line", () => {
    const { rows } = parseRows("INGENIERÍA AMBIENTAL, SUSTENTABILIDAD Y CUIDADO", "DEL PLANETA (TC004) 10/07/2026 Regularidad 7 Aprobado");
    expect(rows).toEqual([
      { name: "INGENIERÍA AMBIENTAL, SUSTENTABILIDAD Y CUIDADO DEL PLANETA", code: "TC004", date: "2026-07-10", type: "regularity", grade: "7", result: "approved" },
    ]);
  });

  it("joins a name that wraps after the date line", () => {
    const { rows } = parseRows(
      "INGENIERÍA AMBIENTAL, SUSTENTABILIDAD Y CUIDADO DEL 10/07/2026 Regularidad 7 Aprobado",
      "PLANETA (TC004)",
      "ECONOMÍA (TC010) 15/12/2024 Examen 7 Aprobado",
    );
    expect(rows.map((r) => [r.name, r.code])).toEqual([
      ["INGENIERÍA AMBIENTAL, SUSTENTABILIDAD Y CUIDADO DEL PLANETA", "TC004"],
      ["ECONOMÍA", "TC010"],
    ]);
  });

  it("joins a name split around a date line in the middle", () => {
    const { rows } = parseRows("INGENIERÍA Y DESARROLLO DE", "18/12/2025 Examen 8 Aprobado", "ENVASES Y EMBALAJES (TA029)");
    expect(rows.map((r) => [r.name, r.code, r.grade])).toEqual([["INGENIERÍA Y DESARROLLO DE ENVASES Y EMBALAJES", "TA029", "8"]]);
  });

  it("keeps parentheses that are part of the name", () => {
    const { rows } = parseRows("INGLÉS (NIVEL I) (CB099) 01/03/2025 Equivalencia Aprobado");
    expect(rows[0]).toMatchObject({ name: "INGLÉS (NIVEL I)", code: "CB099", grade: null, result: "approved" });
  });

  it("does not take the header lines as names, nor the page line as a row", () => {
    const { rows } = parseHistoriaAcademica([
      "HISTORIA ACADÉMICA",
      "Propuesta: Ingeniería Industrial",
      "Alumno: APELLIDO, NOMBRE",
      "SEGUNDO NOMBRE",
      "2 de 3 21/11/2026 08:12:44",
      "Actividad Fecha Tipo Nota Resultado",
      "ECONOMÍA (TC010) 15/12/2024 Examen 7 Aprobado",
    ]);
    expect(rows.map((r) => r.name)).toEqual(["ECONOMÍA"]);
  });

  it("lists lines with a date that are not activities", () => {
    expect(parseRows("ECONOMÍA (TC010) 15/12/2024 Coloquio 7 Aprobado").unparsed).toEqual(["ECONOMÍA (TC010) 15/12/2024 Coloquio 7 Aprobado"]);
  });
});

describe("checkHistory", () => {
  it("accepts the complete history", () => {
    expect(checkHistory(parseHistoriaAcademica(FIXTURE))).toEqual({ ok: true, warnings: [] });
  });

  it("rejects another document", () => {
    const regular = parseHistoriaAcademica(["CERTIFICADO DE ALUMNO REGULAR", "Se certifica que ESTUDIANTE DE PRUEBA es alumno regular de", "Propuesta: Ingeniería Industrial", "03/11/2026"]);
    expect(checkHistory(regular)).toEqual({ ok: false, error: "Este PDF no es la Historia académica completa del SIU." });
  });

  it("rejects a text without the column header or without the title", () => {
    const noColumns = parseHistoriaAcademica(FIXTURE.split(/\r?\n/).filter((l) => !l.startsWith("Actividad")));
    expect(checkHistory(noColumns).ok).toBe(false);
    const noTitle = parseHistoriaAcademica(FIXTURE.split(/\r?\n/).filter((l) => l !== "HISTORIA ACADÉMICA"));
    expect(checkHistory(noTitle).ok).toBe(false);
  });

  it("rejects a history without rows", () => {
    expect(checkHistory(parseRows())).toMatchObject({ ok: false });
  });

  it("warns when it looks filtered: no regularity nor course in progress, or very few rows", () => {
    const onlyApproved = parseHistoriaAcademica(FIXTURE.split(/\r?\n/).filter((l) => !/Regularidad|En curso/.test(l)));
    const check = checkHistory(onlyApproved);
    expect(check.ok).toBe(true);
    expect(check.ok && check.warnings[0]).toMatch(/incompleta o filtrada/);
    const few = checkHistory(parseRows("ECONOMÍA (TC010) 28/11/2024 Regularidad 6 Aprobado"));
    expect(few.ok && few.warnings[0]).toMatch(/incompleta o filtrada/);
  });

  it("warns about lines it could not read", () => {
    const parsed = parseHistoriaAcademica([...FIXTURE.split(/\r?\n/), "ECONOMÍA (TC010) 15/12/2024 Coloquio 7 Aprobado"]);
    const check = checkHistory(parsed);
    expect(check.ok && check.warnings).toEqual(["Una línea del PDF no se pudo leer y no se carga."]);
  });
});

describe("sameCareer", () => {
  it("compares names without accents, case or 'Ingeniería'", () => {
    expect(sameCareer("Ingeniería Industrial", "Ingeniería Industrial")).toBe(true);
    expect(sameCareer("INGENIERIA INDUSTRIAL", "Ingeniería Industrial")).toBe(true);
    expect(sameCareer("Ingeniería en Informática", "Ingeniería en Informática")).toBe(true);
    expect(sameCareer("Ingeniería Electricista", "Ingeniería en Energía Eléctrica")).toBe(true);
  });

  it("tells careers apart", () => {
    expect(sameCareer("Ingeniería Industrial", "Ingeniería Química")).toBe(false);
    expect(sameCareer("Ingeniería Mecánica", "Ingeniería Naval")).toBe(false);
    expect(sameCareer(null, "Ingeniería Industrial")).toBe(false);
    expect(sameCareer("Ingeniería", "Ingeniería Industrial")).toBe(false);
  });
});

describe("interpretHistory", () => {
  it("gets the status of each subject of the fixture", () => {
    const outcomes = interpretHistory(parseHistoriaAcademica(FIXTURE).rows);
    const get = (code: string) => outcomes.find((o) => o.code === code)!;
    expect(outcomes).toHaveLength(18);
    expect(outcomes.filter((o) => o.status === "approved")).toHaveLength(13);
    expect(outcomes.filter((o) => o.status === "final_pending").map((o) => o.code)).toEqual(["TC004", "TA012"]);
    expect(outcomes.filter((o) => o.status === "in_progress").map((o) => o.code)).toEqual(["TB015", "TA039", "TA015"]);
    expect(get("CB001")).toMatchObject({ status: "approved", grade: 6, equivalence: false, date: "2023-08-08", failedExams: 1 });
    expect(get("TB010")).toMatchObject({ status: "approved", grade: 7 }); // the exam before the regularity
    expect(get("CBC62")).toMatchObject({ status: "approved", grade: 6, equivalence: false }); // CBC: equivalence with grade
    expect(get("CBC40")).toMatchObject({ status: "approved", grade: 7 }); // a failed equivalence before is ignored
    expect(get("CBC90")).toMatchObject({ status: "approved", grade: 9 }); // failed and approved the same day
  });

  it("counts failed exams as aplazos, not absences", () => {
    expect(countFailedExams(parseHistoriaAcademica(FIXTURE).rows)).toBe(4);
  });

  it("an equivalence without a grade is approved by equivalence", () => {
    expect(outcomeOf("PROBABILIDAD (CB004) 01/03/2025 Equivalencia Aprobado")[0]).toMatchObject({ status: "approved", grade: null, equivalence: true });
  });

  it("a promotion approves with its grade", () => {
    expect(outcomeOf("CÁLCULO NUMÉRICO (CB051) 01/12/2025 Promoción 9 Aprobado")[0]).toMatchObject({ status: "approved", grade: 9, equivalence: false });
  });

  it("the latest approved exam wins", () => {
    expect(outcomeOf("ECONOMÍA (TC010) 15/12/2024 Examen 5 Aprobado", "ECONOMÍA (TC010) 20/02/2025 Examen 8 Aprobado")[0]).toMatchObject({ grade: 8, date: "2025-02-20" });
  });

  it("an approved regularity without an approval is a pending final", () => {
    expect(outcomeOf("ECONOMÍA (TC010) 28/11/2024 Regularidad 6 Aprobado", "ECONOMÍA (TC010) 15/12/2024 Examen D Reprobado", "ECONOMÍA (TC010) 20/12/2024 Examen Ausente")[0]).toMatchObject({
      status: "final_pending",
      grade: null,
      failedExams: 1,
    });
  });

  it("an approval beats a course in progress, a regularity beats it too", () => {
    expect(outcomeOf("ECONOMÍA (TC010) 15/12/2024 Examen 7 Aprobado", "ECONOMÍA (TC010) 18/08/2026 En curso")[0].status).toBe("approved");
    expect(outcomeOf("ECONOMÍA (TC010) 15/12/2024 Regularidad 7 Aprobado", "ECONOMÍA (TC010) 18/08/2026 En curso")[0].status).toBe("final_pending");
    expect(outcomeOf("ECONOMÍA (TC010) 18/08/2026 En curso")[0].status).toBe("in_progress");
  });

  it("failures and absences alone load nothing", () => {
    const [o] = outcomeOf("ECONOMÍA (TC010) 15/12/2024 Examen D Reprobado", "ECONOMÍA (TC010) 20/12/2024 Examen Ausente", "ECONOMÍA (TC010) 10/12/2024 Regularidad Reprobado");
    expect(o).toMatchObject({ status: null, failedExams: 1 });
    expect(outcomeOf("FÍSICA (CBC03) 20/11/2022 Equivalencia 2 Reprobado")[0].status).toBeNull();
  });

  it("an approved exam with a grade below 4 does not approve", () => {
    expect(outcomeOf("ECONOMÍA (TC010) 15/12/2024 Examen 2 Aprobado")[0].status).toBeNull();
  });
});

describe("matchToPlan", () => {
  const outcomes = interpretHistory(parseHistoriaAcademica(FIXTURE).rows);

  it("matches every subject of the fixture to Industrial 2023, electives included", () => {
    const { matched, unmatched } = matchToPlan(outcomes, PLAN, []);
    expect(unmatched).toEqual([]);
    expect(matched).toHaveLength(18);
    const codeOf = (siu: string) => matched.find((m) => m.outcome.code === siu)?.subject.code;
    expect(codeOf("CBC03")).toBe("CBC3"); // CBC code with a leading zero
    expect(codeOf("CBC62")).toBe("CBC62");
    expect(codeOf("TA030")).toBe("AGROBIO"); // elective by name
    expect(codeOf("TA029")).toBe("IDEE");
    expect(codeOf("CB002")).toBe("AL"); // "ÁLGEBRA LINEAL" by name
  });

  it("uses subject_siu_codes first", () => {
    const [o] = outcomeOf("NOMBRE VIEJO DE LA MATERIA (CB001) 08/08/2023 Examen 6 Aprobado");
    const { matched } = matchToPlan([o], PLAN, [{ subjectId: byCode("AMII").id, code: "CB001" }]);
    expect(matched[0].subject.code).toBe("AMII");
  });

  it("leaves apart what is not in the plan, and what has nothing to load", () => {
    const list = outcomeOf("TALLER DE OTRA CARRERA (TX999) 01/07/2025 Examen 8 Aprobado", "ECONOMÍA (TC010) 15/12/2024 Examen D Reprobado");
    const { matched, unmatched } = matchToPlan(list, PLAN, []);
    expect(matched).toEqual([]);
    expect(unmatched.map((u) => u.code)).toEqual(["TX999"]);
  });

  it("never matches the CBC node", () => {
    const { matched } = matchToPlan(outcomeOf("CICLO BÁSICO COMÚN (CBC) 01/03/2023 Equivalencia Aprobado"), PLAN, []);
    expect(matched).toEqual([]);
  });

  it("two codes of the same subject keep the best outcome", () => {
    const list = outcomeOf("ECONOMÍA (TC010) 15/12/2024 Regularidad 6 Aprobado", "ECONOMIA (61.01) 15/12/2019 Examen 7 Aprobado");
    const { matched } = matchToPlan(list, PLAN, []);
    expect(matched).toHaveLength(1);
    expect(matched[0].outcome).toMatchObject({ status: "approved", grade: 7 });
  });

  it("normalizes codes", () => {
    expect(normalizeCode("cbc03")).toBe("CBC3");
    expect(normalizeCode(" CB001 ")).toBe("CB001");
  });
});

describe("importItems and upsertRows", () => {
  const outcomes = interpretHistory(parseHistoriaAcademica(FIXTURE).rows);
  const { matched } = matchToPlan(outcomes, PLAN, []);

  it("compares with the map: new, same or different", () => {
    const current = new Map<number, SubjectProgress>([
      [byCode("AMII").id, { status: "approved", grade: 6, equivalence: false }],
      [byCode("ECO").id, { status: "final_pending", grade: null }],
    ]);
    const items = importItems(matched, current);
    const change = (code: string) => items.find((i) => i.subject.code === code)!.change;
    expect(change("AMII")).toBe("same");
    expect(change("ECO")).toBe("different");
    expect(change("EA")).toBe("new");
  });

  it("builds one row per subject for a single upsert", () => {
    const [o] = outcomeOf("PROBABILIDAD (CB004) 01/03/2025 Equivalencia Aprobado");
    const items = importItems(matchToPlan([o], PLAN, []).matched, new Map());
    expect(upsertRows("u1", items, true)).toEqual([{ user_id: "u1", subject_id: byCode("PROBA").id, status: "approved", grade: null, by_equivalence: true }]);
    const graded = importItems(matched.filter((m) => m.subject.code === "EA"), new Map());
    expect(upsertRows("u1", graded, false)).toEqual([{ user_id: "u1", subject_id: byCode("EA").id, status: "approved", grade: 5 }]);
  });
});

describe("summaryText", () => {
  it("says what was found", () => {
    expect(summaryText({ approved: 28, finalPending: 4, inProgress: 3, unmatched: 2 })).toBe("Encontramos 28 aprobadas, 4 finales pendientes y 3 cursando; 2 no están en tu plan.");
    expect(summaryText({ approved: 1, finalPending: 1, inProgress: 0, unmatched: 1 })).toBe("Encontramos 1 aprobada y 1 final pendiente; 1 no está en tu plan.");
    expect(summaryText({ approved: 0, finalPending: 0, inProgress: 0, unmatched: 0 })).toBe("Encontramos ninguna materia para cargar.");
  });
});

describe("textLines", () => {
  const piece = (str: string, x: number, y: number, width: number) => ({ str, transform: [9, 0, 0, 9, x, y], width, height: 9 });

  it("groups pieces by height and orders them from left to right", () => {
    const lines = textLines([
      piece("Examen", 300, 700.4, 30),
      piece("ECONOMÍA (TC010)", 40, 700, 80),
      piece("15/12/2024", 220, 699.8, 45),
      piece("7", 380, 700, 5),
      piece("Aprobado", 420, 700, 40),
      piece("HISTORIA ACADÉMICA", 200, 780, 100),
    ]);
    expect(lines).toEqual(["HISTORIA ACADÉMICA", "ECONOMÍA (TC010) 15/12/2024 Examen 7 Aprobado"]);
  });

  it("joins pieces of one word that touch", () => {
    expect(textLines([piece("ANÁ", 40, 700, 20), piece("LISIS", 60, 700, 25), piece("II", 90, 700, 8)])).toEqual(["ANÁLISIS II"]);
  });

  it("the parser reads what it gives", () => {
    const rows: HistoryRow[] = parseHistoriaAcademica(
      textLines([
        piece("HISTORIA ACADÉMICA", 200, 780, 100),
        piece("Actividad", 40, 740, 40),
        piece("Fecha", 220, 740, 30),
        piece("Tipo", 300, 740, 20),
        piece("Nota", 380, 740, 20),
        piece("Resultado", 420, 740, 40),
        piece("ECONOMÍA (TC010)", 40, 700, 80),
        piece("15/12/2024", 220, 700, 45),
        piece("Examen", 300, 700, 30),
        piece("7", 380, 700, 5),
        piece("Aprobado", 420, 700, 40),
      ]),
    ).rows;
    expect(rows).toEqual([{ name: "ECONOMÍA", code: "TC010", date: "2024-12-15", type: "exam", grade: "7", result: "approved" }]);
  });
});
