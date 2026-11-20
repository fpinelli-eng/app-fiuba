import { describe, expect, it } from "vitest";
import type { PlanData, PlanSubject } from "./data";
import type { ClassBlock, WeekDay } from "./options";
import {
  blockBox,
  blockDetail,
  placeInDay,
  placeLabel,
  posterDays,
  posterFromPlan,
  posterHours,
  posterItems,
  posterTotals,
  shortClassType,
  timesLabel,
  type PosterData,
} from "./poster";

const block = (day: WeekDay, start: number, end: number, extra: Partial<ClassBlock> = {}): ClassBlock => ({
  day,
  start: start * 60,
  end: end * 60,
  type: "Teórica",
  room: "403 - PC",
  campus: "Paseo Colón",
  async: false,
  ...extra,
});

const subject = (code: string, name: string, credits: number | null, blocks: ClassBlock[]): PlanSubject => ({
  code,
  name,
  eligibility: "ok",
  credits,
  group: "obligatorias",
  courses: [
    {
      id: `${code}-1`,
      subjectCode: code,
      subjectName: name.toUpperCase(),
      label: "Curso 1",
      courseNumber: "01",
      practice: null,
      teachers: [],
      modality: null,
      blocks,
      quota: null,
      enrolled: null,
      teacherList: "Vargas",
      score: null,
    },
  ],
});

const poster = (over: Partial<PosterData> = {}): PosterData => ({
  term: "2C 2026",
  career: "Ing. Industrial · Plan 2023",
  option: null,
  courses: [],
  activities: [],
  ...over,
});

describe("posterFromPlan", () => {
  const data: PlanData = {
    term: "2C 2026",
    career: "Ing. Industrial · Plan 2023",
    subjects: [
      subject("1", "Economía", 6, [block("Martes", 17, 23)]),
      subject("2", "Higiene y Seguridad", 2, [block("Miércoles", 14, 16)]),
      subject("3", "Estadística Aplicada", 8, [block("Lunes", 14, 17)]),
    ],
    saved: {
      A: [
        { subject: "3", course: "3-1" },
        { subject: "1", course: "1-1" },
        { subject: "9", course: "9-1" }, // ya no está en la oferta
      ],
      B: [],
    },
    enrolled: [],
    activities: [{ id: "7", name: "Ayudantía", place: null, color: "sky", blocks: [{ day: "Jueves", start: 1080, end: 1200 }] }],
  };

  it("takes the courses of the option in order, with the Plan's colors, and the activities", () => {
    const p = posterFromPlan(data, "A");
    expect(p.courses.map((c) => [c.name, c.color, c.teachers])).toEqual([
      ["Estadística Aplicada", "lavender", "Vargas"],
      ["Economía", "mint", "Vargas"],
    ]);
    expect(p.activities.map((a) => a.name)).toEqual(["Ayudantía"]);
  });

  it("names the option only when the other one is in use", () => {
    expect(posterFromPlan(data, "A").option).toBeNull();
    expect(posterFromPlan({ ...data, saved: { ...data.saved, B: [{ subject: "2", course: "2-1" }] } }, "A").option).toBe("A");
  });

  it("has no activities while the table is missing", () => {
    expect(posterFromPlan({ ...data, activities: null }, "B")).toMatchObject({ courses: [], activities: [] });
  });
});

describe("posterItems / posterDays", () => {
  const p = poster({
    courses: [
      {
        name: "Economía",
        credits: 6,
        label: "Curso 4",
        teachers: "",
        color: "lavender",
        blocks: [block("Martes", 17, 23, { type: "Teórico Práctica Obligatoria" }), block("Lunes", 0, 2, { async: true })],
      },
    ],
    activities: [{ name: "Fútbol", place: "Club", color: "mint", blocks: [{ day: "Sábado", start: 600, end: 720 }] }],
  });

  it("leaves asynchronous classes out of the grid and shortens the class type", () => {
    expect(posterItems(p)).toEqual([
      { kind: "course", index: 0, day: "Martes", start: 1020, end: 1380, type: "Teórico-práctica", room: "403 - PC", campus: "Paseo Colón" },
      { kind: "activity", index: 0, day: "Sábado", start: 600, end: 720, type: "", room: "Club", campus: null },
    ]);
  });

  it("joins back-to-back classes of a course in one block", () => {
    const joined = poster({
      courses: [
        {
          name: "Electricidad y Magnetismo",
          credits: 6,
          label: "Curso 10",
          teachers: "",
          color: "mint",
          blocks: [
            block("Miércoles", 17.5, 19, { type: "Práctica Obligatoria", room: "305-PC" }),
            block("Miércoles", 16, 17.5, { type: "Teórica Obligatoria", room: "507 - PC" }),
            block("Viernes", 16, 17.5, { type: "Teórica", room: "305-PC" }),
            block("Viernes", 18, 19, { type: "Práctica", room: "305-PC" }), // con un hueco: aparte
          ],
        },
      ],
    });
    expect(posterItems(joined).map((i) => [i.day, i.start / 60, i.end / 60, i.type, i.room])).toEqual([
      ["Miércoles", 16, 19, "Teórica + Práctica", "507 - PC, 305-PC"],
      ["Viernes", 16, 17.5, "Teórica", "305-PC"],
      ["Viernes", 18, 19, "Práctica", "305-PC"],
    ]);
  });

  it("shows Monday to Friday, plus the weekend days that have something", () => {
    expect(posterDays([])).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    expect(posterDays(posterItems(p))).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]);
    expect(posterDays([{ day: "Domingo" }])).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Domingo"]);
  });
});

describe("posterHours", () => {
  it("compresses the grid to the hours in use, rounded to whole hours", () => {
    expect(posterHours([{ start: 9 * 60, end: 12 * 60 }, { start: 17 * 60, end: 22 * 60 + 30 }])).toEqual({ first: 9, last: 23 });
    expect(posterHours([{ start: 7 * 60 + 30, end: 23 * 60 }])).toEqual({ first: 7, last: 23 });
  });

  it("keeps at least six hours, growing towards the morning", () => {
    expect(posterHours([{ start: 18 * 60, end: 22 * 60 }])).toEqual({ first: 16, last: 22 });
    expect(posterHours([{ start: 60, end: 120 }])).toEqual({ first: 0, last: 6 });
  });

  it("has a default range when the plan is empty", () => {
    expect(posterHours([])).toEqual({ first: 8, last: 20 });
  });
});

describe("placeInDay", () => {
  it("gives a full lane to blocks that do not overlap", () => {
    const placed = placeInDay([
      { id: "b", start: 600, end: 720 },
      { id: "a", start: 480, end: 600 },
    ]);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("splits only the group that overlaps, chained overlaps included", () => {
    const placed = placeInDay([
      { id: "a", start: 480, end: 660 },
      { id: "b", start: 600, end: 720 },
      { id: "c", start: 690, end: 780 }, // pisa a b, no a a: reusa el carril de a
      { id: "d", start: 1080, end: 1200 }, // de noche, solo
    ]);
    expect(placed.map((p) => [p.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
      ["d", 0, 1],
    ]);
  });
});

describe("blockBox / blockDetail", () => {
  it("places blocks as a share of the grid", () => {
    expect(blockBox(9 * 60, 12 * 60, { first: 9, last: 21 })).toEqual({ top: 0, height: 25 });
    expect(blockBox(18 * 60, 21 * 60, { first: 9, last: 21 })).toEqual({ top: 75, height: 25 });
  });

  it("shows more detail the taller the block", () => {
    expect(blockDetail(6)).toBe(1);
    expect(blockDetail(10)).toBe(2);
    expect(blockDetail(15)).toBe(3);
    expect(blockDetail(30)).toBe(4);
  });
});

describe("texts", () => {
  it("shortens the SIU class types", () => {
    expect(shortClassType("Teórico Práctica Obligatoria")).toBe("Teórico-práctica");
    expect(shortClassType("Teórico-Práctica")).toBe("Teórico-práctica");
    expect(shortClassType("Práctica Obligatoria")).toBe("Práctica");
    expect(shortClassType("Laboratorio")).toBe("Laboratorio");
    expect(shortClassType("")).toBe("");
  });

  it("writes the room without repeating the campus", () => {
    expect(placeLabel("403 - PC", "Paseo Colón")).toBe("Aula 403 · PC");
    expect(placeLabel("510 - PC, 200-PC", "Paseo Colón")).toBe("Aula 510, 200 · PC");
    expect(placeLabel("Anf.III-LH", "Las Heras")).toBe("Anf.III · LH");
    expect(placeLabel("Clase Virtual-PC", null)).toBe("Virtual");
    expect(placeLabel("A ASIGN", "Las Heras")).toBe("Aula a confirmar · LH");
    expect(placeLabel(null, null)).toBe("Sede a confirmar");
  });

  it("lists the times of an activity", () => {
    expect(timesLabel([{ day: "Martes", start: 1080, end: 1200 }])).toBe("Mar 18–20");
    expect(
      timesLabel([
        { day: "Lunes", start: 540, end: 660 },
        { day: "Jueves", start: 1080, end: 1230 },
        { day: "Sábado", start: 600, end: 780 },
      ]),
    ).toBe("Lun 9–11, Jue 18–20:30 y Sáb 10–13");
  });
});

describe("posterTotals", () => {
  it("adds credits (unknown ones count as zero) and weekly hours, asynchronous apart", () => {
    const p = poster({
      courses: [
        { name: "A", credits: 6, label: "", teachers: "", color: "lavender", blocks: [block("Lunes", 9, 12), block("Lunes", 0, 2, { async: true })] },
        { name: "B", credits: null, label: "", teachers: "", color: "mint", blocks: [block("Martes", 18, 22)] },
        { name: "C", credits: 8, label: "", teachers: "", color: "butter", blocks: [] },
      ],
      activities: [{ name: "Trabajo", place: null, color: "sky", blocks: [{ day: "Viernes", start: 480, end: 1020 }] }],
    });
    expect(posterTotals(p)).toEqual({ subjects: 3, credits: 14, weeklyMinutes: 420, asyncMinutes: 120 });
  });
});
