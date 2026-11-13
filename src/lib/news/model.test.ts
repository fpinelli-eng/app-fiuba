import { describe, expect, it } from "vitest";
import {
  addDays,
  buenosAiresDate,
  formatNewsDate,
  formatWeekday,
  groupCalendar,
  calendarHighlights,
  formatRemaining,
  dateBadge,
  daysUntil,
  formatCountdown,
  formatDateRange,
  importantDates,
  isImportantDate,
  sortNews,
  validateConfirmation,
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

describe("calendarHighlights", () => {
  const ev = (id: number, title: string, startsOn = "2026-11-09", endsOn = "2026-11-14") => ({ id, title, startsOn, endsOn, sort: id });
  it("lo que pasa ahora, con lo que falta y cuánto pasó; después lo que empieza, hasta cuatro de cada uno", () => {
    const got = calendarHighlights(
      {
        now: [ev(1, "Clases", "2026-11-02", "2026-11-11")],
        soon: [ev(2, "Inscripción"), ev(3, "Exámenes", "2026-11-20")],
        later: [ev(4, "Receso", "2026-12-20"), ev(5, "Verano", "2027-01-05"), ev(6, "x", "2027-02-01")],
      },
      "2026-11-06",
    );
    expect(got.now).toEqual([{ event: expect.objectContaining({ title: "Clases" }), now: true, days: 5, progress: 0.5 }]);
    expect(got.upcoming.map((d) => [d.event.title, d.days])).toEqual([["Inscripción", 3], ["Exámenes", 14], ["Receso", 45], ["Verano", 61]]);
  });
  it("lo que falta para que termine", () => {
    expect([0, 1, 5, 13, 20].map((d) => formatRemaining(d))).toEqual(["Termina hoy", "Termina mañana", "Quedan 5 días", "Quedan 13 días", "Quedan 3 semanas"]);
  });
  it("fechas y cuenta regresiva", () => {
    expect(dateBadge("2026-11-09")).toEqual({ day: "9", month: "nov" });
    expect(daysUntil("2026-11-06", "2026-11-09")).toBe(3);
    expect(daysUntil("2026-12-30", "2027-01-02")).toBe(3);
    expect([0, 1, 3, 13, 21].map((d) => formatCountdown(d))).toEqual(["Hoy", "Mañana", "En 3 días", "En 13 días", "En 3 semanas"]);
  });
});

describe("importantDates", () => {
  const cal = [
    { id: 1, title: "Período de Clases", startsOn: "2026-08-17", endsOn: "2026-12-05", sort: 0 },
    { id: 2, title: "Inscripción para Cursos de Verano 2027", startsOn: "2026-11-09", endsOn: "2026-11-14", sort: 18 },
    { id: 3, title: "Recepción de trámites de simultaneidad entre carreras de FIUBA", startsOn: "2026-08-03", endsOn: "2026-11-28", sort: 21 },
  ];

  it("keeps only the important rows, tentative", () => {
    const out = importantDates(cal, []);
    expect(out.map((e) => e.id)).toEqual([1, 2]);
    expect(out.every((e) => e.tentative)).toBe(true);
  });

  it("replaces a row with its confirmation, keeping its id and place", () => {
    const out = importantDates(cal, [
      { id: 7, title: "Inscripción para Cursos de Verano 2027", startsOn: "2026-11-17", endsOn: "2026-11-18", note: "Mail del 29/10", replaces: 2 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ id: 2, startsOn: "2026-11-17", endsOn: "2026-11-18", sort: 18, tentative: false, note: "Mail del 29/10" });
  });

  it("adds a new confirmed date with a negative id, even if its title is not in the list", () => {
    const out = importantDates(cal, [
      { id: 9, title: "Charla de Ingresantes", startsOn: "2027-03-02", endsOn: "2027-03-02", note: "Mail", replaces: null },
    ]);
    expect(out.at(-1)).toMatchObject({ id: -9, title: "Charla de Ingresantes", tentative: false });
  });

  it("knows which titles matter", () => {
    expect(isImportantDate("Desinscripción de Cursos de Verano")).toBe(true);
    expect(isImportantDate("Inicio de los Cursos de Verano")).toBe(true);
    expect(isImportantDate("Inscripción para Cursar Asignaturas")).toBe(true);
    expect(isImportantDate("Período para abonar el trámite de convalidación para el siguiente cuatrimestre")).toBe(false);
    expect(isImportantDate("Charla de Ingresantes")).toBe(false);
  });
});

describe("tentative dates", () => {
  it("shows weeks when tentative and days when confirmed", () => {
    expect(formatDateRange({ startsOn: "2026-11-09", endsOn: "2026-11-14", tentative: true })).toBe("Semana del 9/11");
    expect(formatDateRange({ startsOn: "2026-11-16", endsOn: "2026-12-05", tentative: true })).toBe("Del 16/11 al 5/12");
    expect(formatDateRange({ startsOn: "2026-11-17", endsOn: "2026-11-18", tentative: false })).toBe("mar 17/11 → mié 18/11");
    expect(formatDateRange({ startsOn: "2026-11-12", endsOn: "2026-11-12" })).toBe("jue 12/11");
  });

  it("counts in weeks when tentative", () => {
    expect(formatCountdown(3, true)).toBe("La semana que viene");
    expect(formatCountdown(7, true)).toBe("La semana que viene");
    expect(formatCountdown(3)).toBe("En 3 días");
    expect(formatCountdown(14, true)).toBe("En 2 semanas");
    expect(formatRemaining(2, true)).toBe("Termina esta semana");
    expect(formatRemaining(2)).toBe("Quedan 2 días");
    expect(formatRemaining(20, true)).toBe("Quedan 3 semanas");
  });
});

describe("validateConfirmation", () => {
  const ok = { title: "Inscripción a cursos de verano", startsOn: "2026-11-17", endsOn: "2026-11-18", note: "Mail del 29/10", replaces: "12" };

  it("accepts a period and a single day", () => {
    expect(validateConfirmation(ok).draft).toEqual({ ...ok, replaces: 12 });
    expect(validateConfirmation({ ...ok, endsOn: "", replaces: "" }).draft).toMatchObject({ endsOn: "2026-11-17", replaces: null });
  });

  it("rejects what does not make sense", () => {
    expect(validateConfirmation({ ...ok, title: " " }).error).toBe("Escribí qué trámite es.");
    expect(validateConfirmation({ ...ok, startsOn: "2026-02-30" }).error).toBe("Elegí el día en que empieza.");
    expect(validateConfirmation({ ...ok, endsOn: "2026-11-16" }).error).toBe("Termina antes de empezar: revisá las fechas.");
    expect(validateConfirmation({ ...ok, note: "" }).error).toContain("de dónde sale la fecha");
    expect(validateConfirmation({ ...ok, replaces: "abc" }).error).toBe("Elegí el trámite de nuevo.");
  });
});
