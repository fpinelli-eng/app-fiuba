import { describe, expect, it } from "vitest";
import { groupExamTables, toMoment, type ExamTableRow } from "./group";

const row = (over: Partial<ExamTableRow>): ExamTableRow => ({
  id: 1,
  siu_subject_code: "TC010",
  siu_subject_name: "ANÁLISIS MATEMÁTICO II",
  name: "MESA 01",
  exam_date: "2026-12-09",
  kind: "Regular",
  enroll_from: "2026-11-30T14:00:00",
  enroll_to: "2026-12-07 14:00:00",
  start_time: null,
  end_time: null,
  room: null,
  drop_until: null,
  teachers: null,
  ...over,
});

const subjects = [
  { id: 10, name: "Física I" },
  { id: 20, name: "Análisis Matemático II" },
  { id: 30, name: "Química" },
];

describe("toMoment", () => {
  it("trims seconds and accepts both separators", () => {
    expect(toMoment("2026-12-07T14:00:00")).toBe("2026-12-07T14:00");
    expect(toMoment("2026-12-07 14:00:00")).toBe("2026-12-07T14:00");
    expect(toMoment(null)).toBeNull();
  });
});

describe("groupExamTables", () => {
  it("maps by known SIU code first, then by name, and merges codes of one subject", () => {
    const { all } = groupExamTables({
      rows: [
        row({ id: 1, siu_subject_code: "CB001", siu_subject_name: "FISICA I A", exam_date: "2026-12-10" }),
        row({
          id: 2,
          siu_subject_code: "TC010",
          start_time: "17:00:00",
          end_time: "20:00:00",
          room: "Aula 3",
          drop_until: "2026-12-08 23:59:00",
          teachers: "SURACE PABLO ESTEBAN (Profesor/a)",
        }),
        row({ id: 3, siu_subject_code: "CB002", siu_subject_name: "FISICA I B", exam_date: "2026-12-05" }),
      ],
      subjects,
      subjectByCode: new Map([
        ["CB001", 10],
        ["CB002", 10],
      ]),
      pendingIds: [],
    });
    expect(all.map((s) => [s.key, s.name, s.tables.map((t) => t.id)])).toEqual([
      ["20", "Análisis Matemático II", [2]],
      ["10", "Física I", [3, 1]],
    ]);
    expect(all[0].tables[0]).toEqual({
      id: 2,
      name: "MESA 01",
      date: "2026-12-09",
      kind: "Regular",
      enrollFrom: "2026-11-30T14:00",
      enrollTo: "2026-12-07T14:00",
      startTime: "17:00",
      endTime: "20:00",
      room: "Aula 3",
      dropUntil: "2026-12-08T23:59",
      teachers: "SURACE PABLO ESTEBAN (Profesor/a)",
    });
  });

  it("sorts tables of the same day by start time", () => {
    const { all } = groupExamTables({
      rows: [
        row({ id: 1, name: "MESA 01", start_time: "18:00:00" }),
        row({ id: 2, name: "MESA 02", start_time: "09:00:00" }),
      ],
      subjects,
      subjectByCode: new Map(),
      pendingIds: [],
    });
    expect(all[0].tables.map((t) => t.id)).toEqual([2, 1]);
  });

  it("keeps subjects outside the plan under their SIU code with a readable name", () => {
    const { all } = groupExamTables({
      rows: [row({ siu_subject_code: "IDI01", siu_subject_name: "PRUEBA DE SUFICIENCIA DE INGLES" })],
      subjects,
      subjectByCode: new Map(),
      pendingIds: [],
    });
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe("IDI01");
    expect(all[0].name).toBe("Prueba de Suficiencia de Ingles");
  });

  it("lists pending finals in the given order, also without tables", () => {
    const { pending } = groupExamTables({
      rows: [row({})],
      subjects,
      subjectByCode: new Map(),
      pendingIds: [30, 20],
    });
    expect(pending.map((s) => [s.key, s.name, s.tables.length])).toEqual([
      ["30", "Química", 0],
      ["20", "Análisis Matemático II", 1],
    ]);
  });
});
