import { describe, expect, it } from "vitest";
import { layoutWeek } from "./calendar";
import type { HomeBlock, HomeCourse } from "./courses";

const block = (weekday: number, from: number, to: number, extra: Partial<HomeBlock> = {}): HomeBlock => ({
  weekday,
  start: from * 60,
  end: to * 60,
  campus: "LH",
  virtual: false,
  async: false,
  ...extra,
});
const course = (subject: string, credits: number, blocks: HomeBlock[]): HomeCourse => ({ offeringId: 1, subject, credits, code: "C01", blocks });

describe("home calendar", () => {
  it("puts each class on its day and adds the credits once per subject", () => {
    const io = course("Investigación Operativa", 8, [block(3, 18, 22), block(4, 18, 22)]);
    const scgc = course("Sistemas Contables", 4, [block(5, 18, 22, { campus: "PC" })]);
    const w = layoutWeek([io, scgc]);
    expect(w.days.map((d) => d.length)).toEqual([0, 0, 1, 1, 1, 0]);
    expect(w.credits).toBe(12);
    expect(w.days[2][0].color).toBe(0);
    expect(w.days[4][0].color).toBe(1);
    expect(w.campuses).toEqual(["PC", "LH"]);
  });

  it("splits overlapping classes in lanes", () => {
    const a = course("A", 4, [block(1, 18, 22)]);
    const b = course("B", 4, [block(1, 19, 21)]);
    const c = course("C", 4, [block(1, 22, 23)]);
    const [monday] = layoutWeek([a, b, c]).days;
    expect(monday.map((p) => [p.course.subject, p.lane, p.lanes])).toEqual([
      ["A", 0, 2],
      ["B", 1, 2],
      ["C", 0, 2],
    ]);
  });

  it("keeps asynchronous classes out of the grid", () => {
    const w = layoutWeek([course("A", 6, [block(2, 8, 12), block(1, 0, 2, { async: true, campus: null })]), course("B", 4, [block(6, 22, 24)])]);
    expect(w.days[0]).toHaveLength(0);
    expect(w.asyncClasses.map((x) => x.course.subject)).toEqual(["A"]);
    expect([w.first, w.last]).toEqual([8, 24]);
  });

  it("joins classes of the same course that follow each other", () => {
    const w = layoutWeek([course("A", 6, [block(1, 19, 21), block(1, 18, 19), block(1, 22, 23)])]);
    expect(w.days[0].map((p) => [p.block.start / 60, p.block.end / 60])).toEqual([
      [18, 21],
      [22, 23],
    ]);
  });

  it("shows only the hours with classes, at least six", () => {
    const evening = layoutWeek([course("A", 4, [block(1, 18, 22)]), course("B", 4, [block(3, 19, 23)])]);
    expect([evening.first, evening.last]).toEqual([18, 24]);
    const late = layoutWeek([course("A", 4, [block(1, 21, 23)])]);
    expect([late.first, late.last]).toEqual([18, 24]);
    const morning = layoutWeek([course("A", 4, [block(1, 9, 11)])]);
    expect([morning.first, morning.last]).toEqual([9, 15]);
  });
});
