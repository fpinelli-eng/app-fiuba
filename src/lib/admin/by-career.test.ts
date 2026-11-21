import { describe, expect, it } from "vitest";
import { filterGroups, groupUsersByCareer, isNewToday, newToday, normalizeSearch, NO_CAREER_KEY, userMatches } from "./by-career";
import type { AdminUser, Usage } from "./usage";

function user(fullName: string, planId: string | null, plan: string | null = null): AdminUser {
  return {
    fullName,
    email: `${normalizeSearch(fullName).replace(/\s+/g, ".")}@fi.uba.ar`,
    planId,
    plan,
    createdAt: "2026-11-01T12:00:00+00:00",
    introSeen: false,
    subjects: 0,
    planCourses: 0,
    signupSource: null,
  };
}

const careers = [
  { id: "civil", shortName: "Ing. Civil", plans: [{ id: "civil-2023" }, { id: "civil-2009" }] },
  { id: "informatica", shortName: "Ing. en Informática", plans: [{ id: "informatica-2023" }] },
  { id: "quimica", shortName: "Ing. Química", plans: [{ id: "quimica-2023" }] },
];

describe("groupUsersByCareer", () => {
  const users = [
    user("Sofía", null),
    user("Ana", "informatica-2023", "Ing. en Informática 2023"),
    user("Beto", "civil-2009", "Ing. Civil 2009"),
    user("Caro", "informatica-2023", "Ing. en Informática 2023"),
    user("Dani", "civil-2023", "Ing. Civil 2023"),
    user("Eva", "quimica-2023", "Ing. Química 2023"),
    user("Fede", "nuevo-2030", "Ing. Nueva 2030"),
  ];

  it("groups the plans of each career, most students first, Sin carrera last", () => {
    const groups = groupUsersByCareer(users, careers, null);
    expect(groups.map((g) => [g.key, g.name, g.users.length])).toEqual([
      ["civil", "Ing. Civil", 2], // ties with Informática: catalog order
      ["informatica", "Ing. en Informática", 2],
      ["quimica", "Ing. Química", 1],
      ["plan:nuevo-2030", "Ing. Nueva 2030", 1],
      [NO_CAREER_KEY, "Sin carrera", 1],
    ]);
    expect(groups.at(-1)?.noPlan).toBe(true);
  });

  it("keeps the order the students came in", () => {
    const civil = groupUsersByCareer(users, careers, null)[0];
    expect(civil.users.map((u) => u.fullName)).toEqual(["Beto", "Dani"]);
  });

  it("takes the active count per career from admin_uso(), or null", () => {
    const byCareer: Usage["byCareer"] = [
      { id: "civil", name: "Ing. Civil", users: 2, active7d: 1, noPlan: false },
      { id: null, name: "Sin plan", users: 1, active7d: 0, noPlan: true },
    ];
    const groups = groupUsersByCareer(users, careers, byCareer);
    expect(groups.find((g) => g.key === "civil")?.active7d).toBe(1);
    expect(groups.find((g) => g.key === NO_CAREER_KEY)?.active7d).toBe(0);
    expect(groups.find((g) => g.key === "quimica")?.active7d).toBeNull();
    expect(groupUsersByCareer(users, careers, null).every((g) => g.active7d === null)).toBe(true);
  });

  it("is empty without students", () => {
    expect(groupUsersByCareer([], careers, null)).toEqual([]);
  });
});

describe("search", () => {
  it("ignores accents and case and needs every word", () => {
    const u = user("José Pérez", "civil-2023", "Ing. Civil 2023");
    expect(userMatches(u, normalizeSearch("PEREZ"))).toBe(true);
    expect(userMatches(u, normalizeSearch("jose civil"))).toBe(true);
    expect(userMatches(u, normalizeSearch("jose quimica"))).toBe(false);
    expect(userMatches(u, normalizeSearch("jose.perez@"))).toBe(true);
  });

  it("keeps only the groups with matches", () => {
    const groups = groupUsersByCareer(
      [user("Ana", "civil-2023"), user("Beto", "civil-2023"), user("Anabel", "quimica-2023"), user("Caro", null)],
      careers,
      null,
    );
    expect(filterGroups(groups, "ana").map((g) => [g.group.key, g.matches.map((u) => u.fullName)])).toEqual([
      ["civil", ["Ana"]],
      ["quimica", ["Anabel"]],
    ]);
    expect(filterGroups(groups, "  ")).toHaveLength(3);
    expect(filterGroups(groups, "zzz")).toEqual([]);
  });
});

describe("new today (Buenos Aires day)", () => {
  // 20/11 at 12:00 in Buenos Aires (UTC-3).
  const NOW = Date.parse("2026-11-20T15:00:00Z");
  const at = (createdAt: string) => ({ ...user("Ana", null), createdAt });

  it("the day starts at 00:00 in Buenos Aires, not in UTC", () => {
    expect(isNewToday(at("2026-11-20T03:00:00Z"), NOW)).toBe(true); // 00:00 of 20/11
    expect(isNewToday(at("2026-11-20T02:59:59Z"), NOW)).toBe(false); // 23:59 of 19/11, already 20/11 in UTC
    expect(isNewToday(at("2026-11-20T14:59:00+00:00"), NOW)).toBe(true);
    expect(isNewToday(at(""), NOW)).toBe(false);
  });

  it("late at night the UTC day already changed, Buenos Aires not yet", () => {
    const night = Date.parse("2026-11-21T02:30:00Z"); // 23:30 of 20/11 in Buenos Aires
    expect(isNewToday(at("2026-11-20T10:00:00Z"), night)).toBe(true);
    expect(isNewToday(at("2026-11-21T03:10:00Z"), Date.parse("2026-11-21T03:20:00Z"))).toBe(true);
    expect(isNewToday(at("2026-11-20T10:00:00Z"), Date.parse("2026-11-21T03:20:00Z"))).toBe(false);
  });

  it("lists only today, newest first", () => {
    const list = newToday([at("2026-11-20T04:00:00Z"), at("2026-11-19T20:00:00Z"), { ...at("2026-11-20T14:00:00Z"), fullName: "Beto" }], NOW);
    expect(list.map((u) => [u.fullName, u.createdAt])).toEqual([
      ["Beto", "2026-11-20T14:00:00Z"],
      ["Ana", "2026-11-20T04:00:00Z"],
    ]);
  });
});
