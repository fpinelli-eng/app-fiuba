import { describe, expect, it } from "vitest";
import { courseStars, mixComments, termRank, type AppCommentRow, type DollyCommentRow } from "./merge";

describe("courseStars", () => {
  it("mixes app reviews and Dolly opinions in one score and distribution", () => {
    const out = courseStars([
      { courseId: 1, source: "app", stars: 5, n: 2 },
      { courseId: 1, source: "dolly", stars: 3, n: 1 },
      { courseId: 1, source: "dolly", stars: 2, n: 1 },
      { courseId: 2, source: "app", stars: 4, n: 1 },
    ]);
    expect(out.get(1)).toEqual({ score: { average: 15 / 4, count: 4 }, distribution: [2, 0, 1, 1, 0], dolly: 2 });
    expect(out.get(2)).toEqual({ score: { average: 4, count: 1 }, distribution: [0, 1, 0, 0, 0], dolly: 0 });
  });

  it("scores a course with only Dolly opinions", () => {
    expect(courseStars([{ courseId: 7, source: "dolly", stars: 4, n: 3 }]).get(7)?.score).toEqual({ average: 4, count: 3 });
  });

  it("leaves out courses without reviews and invalid rows", () => {
    const out = courseStars([
      { courseId: 1, source: "app", stars: 0, n: 1 },
      { courseId: 1, source: "app", stars: 4, n: 0 },
    ]);
    expect(out.size).toBe(0);
  });
});

describe("termRank", () => {
  it("sorts app terms and Dolly terms on the same scale", () => {
    expect(termRank("2026-2C")).toBe(20262);
    expect(termRank("2C 2021")).toBe(20212);
    expect(termRank("1C 2026")).toBeLessThan(termRank("2026-2C"));
    expect(termRank("2C 2025")).toBeLessThan(termRank("2026-1C"));
    expect(termRank("raro")).toBe(0);
  });
});

const app = (id: number, termId: string, createdAt: string, pinned = false): AppCommentRow => ({
  id,
  stars: 4,
  comment: `app ${id}`,
  pinned,
  termId,
  termLabel: termId,
  createdAt,
});
const dolly = (id: number, termLabel: string): DollyCommentRow => ({ id, stars: 3, comment: `dolly ${id}`, teacher: "Vargas", termLabel });

describe("mixComments", () => {
  it("puts pinned app reviews first, then the newest term", () => {
    const list = mixComments(
      [app(1, "2026-1C", "2026-05-01T00:00:00Z"), app(2, "2026-2C", "2026-11-01T00:00:00Z"), app(3, "2026-1C", "2026-04-01T00:00:00Z", true)],
      [dolly(1, "2C 2022"), dolly(2, "1C 2024")],
    );
    expect(list.map((c) => c.key)).toEqual(["app-3", "app-2", "app-1", "dolly-2", "dolly-1"]);
  });

  it("puts app reviews before Dolly in the same term, newest app first", () => {
    const list = mixComments(
      [app(1, "2024-1C", "2024-03-01T00:00:00Z"), app(2, "2024-1C", "2024-06-01T00:00:00Z")],
      [dolly(9, "1C 2024"), dolly(8, "2C 2024")],
    );
    expect(list.map((c) => c.key)).toEqual(["dolly-8", "app-2", "app-1", "dolly-9"]);
  });

  it("marks the source and keeps the teacher of Dolly opinions", () => {
    const [a, d] = mixComments([app(5, "2026-2C", "2026-11-01T00:00:00Z")], [dolly(5, "2C 2022")]);
    expect(a).toMatchObject({ key: "app-5", source: "app", teacher: null, pinned: false });
    expect(d).toMatchObject({ key: "dolly-5", source: "dolly", teacher: "Vargas", termLabel: "2C 2022", pinned: false });
  });
});
