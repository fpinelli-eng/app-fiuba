import { describe, expect, it } from "vitest";
import { enrolledEntries, sameCourses, startingEntries } from "./cursada";

const subjects = [
  { code: "1", courses: [{ id: "10" }, { id: "11" }] },
  { code: "2", courses: [{ id: "20" }] },
  { code: "3", courses: [{ id: "30" }, { id: "31" }] },
];

describe("sameCourses", () => {
  it("ignores the order", () => {
    expect(sameCourses(["10", "20"], ["20", "10"])).toBe(true);
  });
  it("tells different courses apart", () => {
    expect(sameCourses(["10", "20"], ["11", "20"])).toBe(false);
    expect(sameCourses(["10"], ["10", "20"])).toBe(false);
    expect(sameCourses([], [])).toBe(true);
  });
});

describe("enrolledEntries", () => {
  it("keeps the order of the subjects and skips courses no longer on screen", () => {
    expect(enrolledEntries(["31", "10", "99"], subjects)).toEqual([
      { subject: "1", course: "10" },
      { subject: "3", course: "31" },
    ]);
  });
});

describe("startingEntries", () => {
  const option = [{ subject: "2", course: "20" }];
  it("starts from the confirmed cursada when there is one", () => {
    expect(startingEntries([{ subject: "1", course: "11" }], option)).toEqual([{ subject: "1", course: "11" }]);
  });
  it("otherwise starts from the option, as a copy", () => {
    const start = startingEntries([], option);
    expect(start).toEqual(option);
    start[0].course = "x";
    expect(option[0].course).toBe("20");
  });
});
