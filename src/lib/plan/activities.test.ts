import { describe, expect, it } from "vitest";
import { analyzePlan } from "./analyze";
import {
  activityKey,
  blockPosition,
  daysToShow,
  fromRow,
  hourRange,
  nextColor,
  parseTime,
  timeValue,
  toRow,
  validateActivity,
  type PlanActivity,
} from "./activities";
import type { CourseOption } from "./options";

const hhmm = (h: number, m = 0) => h * 60 + m;

const course = (id: string, blocks: CourseOption["blocks"], subjectCode = id): CourseOption => ({
  id,
  subjectCode,
  subjectName: id,
  label: "Curso 1",
  courseNumber: "01",
  practice: null,
  teachers: [],
  modality: null,
  blocks,
  quota: null,
  enrolled: null,
});

const ayudantia: PlanActivity = {
  id: "7",
  name: "Ayudantía Análisis II",
  place: "Paseo Colón",
  color: "sky",
  blocks: [{ day: "Martes", start: hhmm(18), end: hhmm(20) }],
};

describe("validateActivity", () => {
  const ok = { name: "  Trabajo   de  tarde ", place: "  ", color: "mint", blocks: [{ day: "Viernes", start: hhmm(14), end: hhmm(18) }] };

  it("cleans the name and the place", () => {
    const r = validateActivity(ok);
    expect(r.error).toBeNull();
    expect(r.value).toEqual({ name: "Trabajo de tarde", place: null, color: "mint", blocks: [{ day: "Viernes", start: hhmm(14), end: hhmm(18) }] });
  });

  it("sorts the blocks by day and time", () => {
    const r = validateActivity({
      ...ok,
      blocks: [
        { day: "Domingo", start: hhmm(10), end: hhmm(11) },
        { day: "Lunes", start: hhmm(18), end: hhmm(19) },
        { day: "Lunes", start: hhmm(8), end: hhmm(9) },
      ],
    });
    expect(r.value?.blocks.map((b) => [b.day, b.start])).toEqual([
      ["Lunes", hhmm(8)],
      ["Lunes", hhmm(18)],
      ["Domingo", hhmm(10)],
    ]);
  });

  it.each([
    [{ ...ok, name: "   " }, "Ponele un nombre a la actividad."],
    [{ ...ok, name: "a".repeat(61) }, "El nombre puede tener hasta 60 letras."],
    [{ ...ok, place: "a".repeat(81) }, "El lugar o la nota puede tener hasta 80 letras."],
    [{ ...ok, color: "red" }, "Elegí un color."],
    [{ ...ok, blocks: [] }, "Agregá al menos un horario."],
    [{ ...ok, blocks: Array.from({ length: 11 }, (_, i) => ({ day: "Lunes", start: i * 60, end: i * 60 + 30 })) }, "Podés cargar hasta 10 horarios por actividad."],
    [{ ...ok, blocks: [{ day: "Feriado", start: 0, end: 60 }] }, "Elegí el día de cada horario."],
    [{ ...ok, blocks: [{ day: "Lunes", start: null, end: 60 }] }, "Completá la hora de inicio y de fin de cada horario."],
    [{ ...ok, blocks: [{ day: "Lunes", start: hhmm(20), end: hhmm(18) }] }, "Cada horario tiene que terminar después de empezar."],
    [{ ...ok, blocks: [{ day: "Lunes", start: hhmm(18), end: hhmm(18) }] }, "Cada horario tiene que terminar después de empezar."],
    [{ ...ok, blocks: [{ day: "Lunes", start: hhmm(22), end: hhmm(25) }] }, "Revisá las horas: tienen que estar dentro del día."],
    [
      { ...ok, blocks: [{ day: "Lunes", start: hhmm(18), end: hhmm(20) }, { day: "Lunes", start: hhmm(19), end: hhmm(21) }] },
      "Dos horarios de la actividad se pisan: unilos en uno.",
    ],
    [null, "Faltan los datos de la actividad."],
  ])("refuses %j", (input, error) => {
    expect(validateActivity(input)).toEqual({ value: null, error });
  });

  it("accepts blocks that touch, and a whole day", () => {
    const touching = validateActivity({ ...ok, blocks: [{ day: "Lunes", start: hhmm(18), end: hhmm(20) }, { day: "Lunes", start: hhmm(20), end: hhmm(21) }] });
    expect(touching.error).toBeNull();
    expect(validateActivity({ ...ok, blocks: [{ day: "Sábado", start: 0, end: 24 * 60 }] }).error).toBeNull();
  });
});

describe("rows", () => {
  it("goes to the database and back", () => {
    const row = toRow(ayudantia);
    expect(row.blocks).toEqual([{ weekday: 2, starts_at: hhmm(18), ends_at: hhmm(20) }]);
    expect(fromRow({ id: 7, ...row })).toEqual(ayudantia);
  });

  it("reads Sunday as day 7 and skips broken blocks", () => {
    const a = fromRow({
      id: 1,
      name: "Fútbol",
      place: null,
      color: "otro",
      blocks: [
        { weekday: 7, starts_at: 600, ends_at: 720 },
        { weekday: 9, starts_at: 600, ends_at: 720 },
      ],
    });
    expect(a.color).toBe("lavender");
    expect(a.blocks).toEqual([{ day: "Domingo", start: 600, end: 720 }]);
  });
});

describe("analyzePlan with activities", () => {
  const analisis = course("CB005-01", [{ day: "Martes", start: hhmm(19), end: hhmm(22), type: "Teórica", room: null, campus: "Paseo Colón", async: false }]);

  it("warns when an activity overlaps a course, with its exact time", () => {
    const r = analyzePlan([{ option: analisis, credits: 6 }], [ayudantia]);
    expect(r.overlaps).toEqual([{ day: "Martes", start: hhmm(19), end: hhmm(20), courseIds: [activityKey("7"), "CB005-01"] }]);
  });

  it("does not count activities as subjects, credits or class hours", () => {
    const r = analyzePlan([{ option: analisis, credits: 6 }], [ayudantia]);
    expect(r.subjects).toBe(1);
    expect(r.credits).toBe(6);
    expect(r.weeklyMinutes).toBe(hhmm(3));
  });

  it("warns when two activities overlap, but not inside one activity", () => {
    const gimnasio: PlanActivity = { ...ayudantia, id: "8", name: "Gimnasio", blocks: [{ day: "Martes", start: hhmm(19, 30), end: hhmm(21) }] };
    const r = analyzePlan([], [ayudantia, gimnasio]);
    expect(r.overlaps.map((o) => o.courseIds)).toEqual([[activityKey("7"), activityKey("8")]]);
    expect(analyzePlan([], [ayudantia]).overlaps).toEqual([]);
  });

  it("does not hide a rushed trip between two classes behind an activity in the middle", () => {
    const pc = course("A-01", [{ day: "Lunes", start: hhmm(9), end: hhmm(11), type: "", room: null, campus: "Paseo Colón", async: false }]);
    const lh = course("B-01", [{ day: "Lunes", start: hhmm(11, 30), end: hhmm(13), type: "", room: null, campus: "Las Heras", async: false }]);
    const almuerzo: PlanActivity = { ...ayudantia, blocks: [{ day: "Lunes", start: hhmm(11), end: hhmm(11, 30) }] };
    const r = analyzePlan([{ option: pc }, { option: lh }], [almuerzo]);
    expect(r.rushedTransfers.map((t) => t.courseIds)).toEqual([["A-01", "B-01"]]);
    expect(r.overlaps).toEqual([]);
  });
});

describe("calendar layout", () => {
  it("shows Sunday only when something happens on Sunday", () => {
    expect(daysToShow([{ day: "Lunes" }])).toHaveLength(6);
    expect(daysToShow([{ day: "Domingo" }])).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]);
  });

  it("widens the hours for early or late activities", () => {
    expect(hourRange([{ start: hhmm(9), end: hhmm(13) }])).toEqual({ first: 7, last: 23 });
    expect(hourRange([{ start: hhmm(6, 30), end: hhmm(8) }, { start: hhmm(22), end: hhmm(23, 15) }])).toEqual({ first: 6, last: 24 });
  });

  it("places a block from the first hour of the grid", () => {
    expect(blockPosition(hhmm(9), hhmm(11), 7, 38)).toEqual({ top: 77, height: 73 });
    expect(blockPosition(hhmm(6), hhmm(7), 6, 38)).toEqual({ top: 1, height: 35 });
  });
});

describe("time fields", () => {
  it("parses and prints hh:mm", () => {
    expect(parseTime("18:30")).toBe(1110);
    expect(parseTime("7:05")).toBe(425);
    expect(parseTime("24:00")).toBe(1440);
    expect(parseTime("24:30")).toBeNull();
    expect(parseTime("18:75")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(timeValue(425)).toBe("07:05");
  });
});

describe("nextColor", () => {
  it("suggests a color no other activity uses", () => {
    expect(nextColor([])).toBe("sky");
    expect(nextColor([{ color: "sky" }, { color: "butter" }])).toBe("pink");
  });
});
