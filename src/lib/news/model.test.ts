import { describe, expect, it } from "vitest";
import {
  addDays,
  buenosAiresDate,
  formatNewsDate,
  formatWeekday,
  groupCalendar,
  nextDates,
  sortNews,
  validateNews,
  type AcademicEvent,
  type NewsItem,
} from "./model";

let nextId = 1;
const ev = (title: string, startsOn: string, endsOn: string, sort = 0): AcademicEvent => ({
  id: nextId++,
  title,
  startsOn,
  endsOn,
  sort,
});

describe("dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-02", 28)).toBe("2026-11-30");
    expect(addDays("2026-12-20", 120)).toBe("2027-04-19");
  });

  it("uses the Buenos Aires day", () => {
    // 01:30 UTC on Nov 3 is still Nov 2 in Buenos Aires (UTC-3).
    expect(buenosAiresDate(new Date("2026-11-03T01:30:00Z"))).toBe("2026-11-02");
    expect(buenosAiresDate(new Date("2026-11-03T03:30:00Z"))).toBe("2026-11-03");
  });

  it("formats week days", () => {
    expect(formatWeekday("2026-11-28")).toBe("sáb 28/11");
    expect(formatWeekday("2026-11-23")).toBe("lun 23/11");
  });

  it("formats the date of an aviso", () => {
    expect(formatNewsDate("2026-11-02T15:00:00+00:00", "2026-11-02")).toBe("2 nov");
    expect(formatNewsDate("2026-11-03T01:00:00Z", "2026-11-03")).toBe("2 nov");
    expect(formatNewsDate("2025-12-20T15:00:00Z", "2026-11-02")).toBe("20 dic 2025");
  });
});

describe("groupCalendar", () => {
  const today = "2026-11-02"; // a Monday
  const events = [
    ev("Período de Clases", "2026-08-17", "2026-12-05", 0),
    ev("Publicación de oferta horaria de cursos de verano", "2026-11-02", "2026-11-07", 17),
    ev("Evaluaciones Parciales", "2026-09-21", "2026-10-24", 1),
    ev("Inscripción para Cursos de Verano 2027", "2026-11-09", "2026-11-14", 18),
    ev("Inscripción para Evaluaciones Integradoras", "2026-11-23", "2026-12-19", 11),
    ev("Admisión de estudiantes del CBC", "2026-11-23", "2026-12-19", 12),
    ev("Evaluaciones Integradoras", "2026-12-07", "2026-12-19", 5),
    ev("Inicio de los Cursos de Verano", "2027-01-04", "2027-02-27", 20),
    ev("Período de Clases", "2027-03-08", "2027-04-03", 0),
  ];
  const groups = groupCalendar(events, today);
  const titles = (list: AcademicEvent[]) => list.map((e) => e.title);

  it("puts the ongoing events in Ahora, the ones that end first first", () => {
    expect(titles(groups.now)).toEqual(["Publicación de oferta horaria de cursos de verano", "Período de Clases"]);
  });

  it("puts the ones starting in the next 28 days in Próximamente, by start and row", () => {
    expect(titles(groups.soon)).toEqual([
      "Inscripción para Cursos de Verano 2027",
      "Inscripción para Evaluaciones Integradoras",
      "Admisión de estudiantes del CBC",
    ]);
  });

  it("puts the rest up to 120 days ahead in Más adelante, and leaves out past and far events", () => {
    expect(titles(groups.later)).toEqual(["Evaluaciones Integradoras", "Inicio de los Cursos de Verano"]);
  });

  it("includes the event that ends today and the one that starts on day 28", () => {
    const g = groupCalendar([ev("a", "2026-10-26", "2026-11-02"), ev("b", "2026-11-30", "2026-12-05")], today);
    expect(titles(g.now)).toEqual(["a"]);
    expect(titles(g.soon)).toEqual(["b"]);
  });
});

describe("sortNews", () => {
  const item = (id: number, pinned: boolean, publishedAt: string): NewsItem => ({
    id,
    title: `n${id}`,
    body: null,
    url: null,
    pinned,
    publishedAt,
  });

  it("shows pinned first, then the newest", () => {
    const sorted = sortNews([
      item(1, false, "2026-10-01T10:00:00Z"),
      item(2, true, "2026-09-01T10:00:00Z"),
      item(3, false, "2026-11-01T10:00:00Z"),
    ]);
    expect(sorted.map((n) => n.id)).toEqual([2, 3, 1]);
  });
});

describe("validateNews", () => {
  it("trims and turns empty fields into null", () => {
    expect(validateNews({ title: "  Aviso  ", body: "   ", url: "" })).toEqual({
      draft: { title: "Aviso", body: null, url: null },
    });
  });

  it("asks for a title and limits the lengths", () => {
    expect(validateNews({ title: " ", body: "", url: "" }).error).toBeTruthy();
    expect(validateNews({ title: "a".repeat(141), body: "", url: "" }).error).toBeTruthy();
    expect(validateNews({ title: "a", body: "b".repeat(2001), url: "" }).error).toBeTruthy();
  });

  it("only accepts web links", () => {
    expect(validateNews({ title: "a", body: "", url: "https://www.ingenieria.uba.ar/x" })).toEqual({
      draft: { title: "a", body: null, url: "https://www.ingenieria.uba.ar/x" },
    });
    expect(validateNews({ title: "a", body: "", url: "javascript:alert(1)" }).error).toBeTruthy();
    expect(validateNews({ title: "a", body: "", url: "www.fi.uba.ar" }).error).toBeTruthy();
  });
});

describe("nextDates", () => {
  const ev = (id: number, title: string) => ({ id, title, startsOn: "2026-11-09", endsOn: "2026-11-14", sort: id });
  it("primero lo que pasa ahora, después lo que empieza antes, hasta tres", () => {
    const got = nextDates({ now: [ev(1, "Clases")], soon: [ev(2, "Inscripción"), ev(3, "Exámenes"), ev(4, "Receso")], later: [ev(5, "x")] });
    expect(got.map((d) => [d.event.title, d.now])).toEqual([["Clases", true], ["Inscripción", false], ["Exámenes", false]]);
  });
});
