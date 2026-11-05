import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSiuExams } from "../siu/exams";
import { parseSiuExamsHtml } from "../siu/exams-html";
import { examPreviewRows, examRows, examStats, planMismatch } from "./exams";

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
      start_time: null,
    });
  });

  it("keeps the times, room, drop deadline and teachers read from the SIU page", () => {
    const page = parseSiuExamsHtml(readFileSync(new URL("../../../data/siu/examenes_industrial-2023.html", import.meta.url), "latin1"));
    expect(examRows(page, "industrial-2023").find((r) => r.siu_subject_code === "TC010")).toMatchObject({
      name: "Mesa 1 Surace",
      start_time: "17:00",
      end_time: null,
      room: null,
      drop_until: "2026-12-10T23:59",
      teachers: "SURACE PABLO ESTEBAN (Profesor/a)",
    });
    const preview = examPreviewRows(page);
    expect(preview).toHaveLength(131);
    expect(preview[0].date <= preview.at(-1)!.date).toBe(true);
    expect(preview.find((r) => r.subject === "ECONOMÍA")).toMatchObject({ startTime: "17:00" });
  });
});
