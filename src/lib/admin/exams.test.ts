import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSiuExams } from "../siu/exams";
import { examRows, examStats, planMismatch } from "./exams";

const parsed = parseSiuExams(readFileSync(new URL("../../../data/siu/examenes_industrial-2023.txt", import.meta.url), "utf-8"));

describe("exam dates for the admin screen", () => {
  it("summarizes subjects, tables and the date range", () => {
    expect(examStats(parsed)).toMatchObject({ subjects: 26, tables: 131 });
    const { from, to } = examStats(parsed);
    expect(from! <= to!).toBe(true);
  });

  it("flags a text copied for another career or plan", () => {
    expect(planMismatch(parsed, "Ingeniería Industrial", 2023)).toBeNull();
    expect(planMismatch(parsed, "Ingenieria industrial", 2023)).toBeNull(); // accents and case don't matter
    expect(planMismatch(parsed, "Ingeniería Civil", 2023)).toBe("Ingeniería Industrial · Plan 2023");
    expect(planMismatch(parsed, "Ingeniería Industrial", 2011)).toBe("Ingeniería Industrial · Plan 2023");
  });

  it("builds one row per exam table", () => {
    const rows = examRows(parsed, "industrial-2023");
    expect(rows).toHaveLength(131);
    expect(rows.find((r) => r.siu_subject_code === "TC010")).toMatchObject({
      plan_id: "industrial-2023",
      siu_subject_name: "ECONOMÍA",
      name: "Mesa 1 Surace",
      exam_date: "2026-12-11",
      enroll_from: "2026-11-16T08:00",
    });
  });
});
