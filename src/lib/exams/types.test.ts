import { describe, expect, it } from "vitest";
import { enrollmentStatus, formatEnrollMoment, formatExamDay } from "./types";

describe("enrollmentStatus", () => {
  const table = { enrollFrom: "2026-11-30T14:00", enrollTo: "2026-12-07T14:00" };

  it("is open between the start and the end", () => {
    expect(enrollmentStatus(table, "2026-12-01T10:00")).toEqual({ kind: "open", until: "2026-12-07T14:00" });
    expect(enrollmentStatus(table, "2026-12-07T14:00")).toEqual({ kind: "open", until: "2026-12-07T14:00" });
  });

  it("is coming before the start and closed after the end", () => {
    expect(enrollmentStatus(table, "2026-11-30T13:59")).toEqual({ kind: "soon", from: "2026-11-30T14:00" });
    expect(enrollmentStatus(table, "2026-12-07T14:01")).toEqual({ kind: "closed" });
  });

  it("is unknown without an end, and open without a start", () => {
    expect(enrollmentStatus({ enrollFrom: null, enrollTo: null }, "2026-12-01T10:00")).toEqual({ kind: "unknown" });
    expect(enrollmentStatus({ enrollFrom: null, enrollTo: "2026-12-07T14:00" }, "2026-12-01T10:00").kind).toBe("open");
  });
});

describe("formats", () => {
  it("writes exam days with the weekday", () => {
    expect(formatExamDay("2026-12-09")).toBe("Mié 9/12");
    expect(formatExamDay("2027-02-04")).toBe("Jue 4/2");
  });

  it("drops midnight times from enrollment moments", () => {
    expect(formatEnrollMoment("2026-12-07T14:00")).toBe("7/12 14:00");
    expect(formatEnrollMoment("2026-12-07T23:59")).toBe("7/12");
    expect(formatEnrollMoment("2026-11-16T00:00")).toBe("16/11");
  });
});
