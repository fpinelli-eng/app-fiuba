import { describe, expect, it } from "vitest";
import { hourLabel, hourRangeLabel, peakIndex, toByHour } from "./by-hour";
import { toUsage } from "./usage";

describe("toByHour", () => {
  it("reads the hours and days of admin_uso()", () => {
    expect(
      toByHour({
        hours: [
          { hour: "2026-11-21T16:00:00+00:00", users: 3 },
          { hour: "2026-11-21T17:00:00+00:00", users: "5" },
        ],
        days: [{ day: "2026-11-21", peak: 5, total: 8 }],
      }),
    ).toEqual({
      hours: [
        { hour: "2026-11-21T16:00:00+00:00", users: 3 },
        { hour: "2026-11-21T17:00:00+00:00", users: 5 },
      ],
      days: [{ day: "2026-11-21", peak: 5, total: 8 }],
    });
  });

  it("is null when admin_uso() didn't send it or it is empty", () => {
    expect(toByHour(undefined)).toBeNull();
    expect(toByHour(null)).toBeNull();
    expect(toByHour({ hours: null, days: null })).toBeNull();
  });

  it("drops malformed rows", () => {
    expect(toByHour({ hours: [{ hour: "x", users: 1 }], days: [{ day: "ayer", peak: 1 }, { day: "2026-11-20", peak: -2 }] })).toEqual({
      hours: [],
      days: [{ day: "2026-11-20", peak: 0, total: 0 }],
    });
  });

  it("toUsage keeps it, or null with the older shape", () => {
    expect(toUsage({ by_hour: { hours: [{ hour: "2026-11-21T17:00:00Z", users: 2 }], days: [] } }).byHour?.hours).toHaveLength(1);
    expect(toUsage({ users: 3 }).byHour).toBeNull();
  });
});

describe("peakIndex", () => {
  it("is the largest value, the most recent on a tie", () => {
    expect(peakIndex([1, 4, 2])).toBe(1);
    expect(peakIndex([3, 1, 3])).toBe(2);
  });

  it("is -1 with no visits", () => {
    expect(peakIndex([])).toBe(-1);
    expect(peakIndex([0, 0])).toBe(-1);
  });
});

describe("hour labels in Buenos Aires time", () => {
  it("hours", () => {
    expect(hourLabel("2026-11-21T17:00:00Z")).toBe("14 h");
    expect(hourLabel("2026-11-21T03:00:00Z")).toBe("0 h");
    expect(hourRangeLabel("2026-11-21T17:00:00Z")).toBe("14 a 15 h");
    expect(hourRangeLabel("2026-11-22T02:00:00Z")).toBe("23 a 0 h");
  });
});
