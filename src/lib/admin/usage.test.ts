import { describe, expect, it } from "vitest";
import {
  barHeights,
  dayLabel,
  deploymentState,
  formatBytes,
  formatPercent,
  hourLabel,
  latencyLevel,
  peakWhen,
  percent,
  storageLevel,
  students,
  toDeployments,
  toUsage,
} from "./usage";

// toLocaleString("es-AR") may use a narrow no-break space; compare with plain spaces.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("formatBytes", () => {
  it("uses powers of 1024 and a decimal comma", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1536)).toBe("1,5 kB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
    expect(formatBytes(12.34 * 1024 * 1024)).toBe("12,3 MB");
    expect(formatBytes(500 * 1024 * 1024)).toBe("500 MB");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2 GB");
  });
});

describe("percent", () => {
  it("is clamped to 0–100 and safe with no total", () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(5, 0)).toBe(0);
    expect(percent(300, 200)).toBe(100);
    expect(percent(-1, 10)).toBe(0);
  });

  it("formats in Spanish", () => {
    expect(formatPercent(0)).toBe("0 %");
    expect(formatPercent(0.04)).toBe("menos de 0,1 %");
    expect(formatPercent(3.14)).toBe("3,1 %");
    expect(formatPercent(42.4)).toBe("42 %");
  });

  it("storage levels", () => {
    expect(storageLevel(10)).toBe("ok");
    expect(storageLevel(70)).toBe("warn");
    expect(storageLevel(95)).toBe("bad");
  });
});

describe("barHeights", () => {
  it("scales against the biggest bar", () => {
    expect(barHeights([0, 5, 10])).toEqual({ max: 10, heights: [0, 50, 100] });
  });

  it("stays flat with no data", () => {
    expect(barHeights([0, 0])).toEqual({ max: 1, heights: [0, 0] });
    expect(barHeights([])).toEqual({ max: 1, heights: [] });
  });
});

describe("labels in Buenos Aires time", () => {
  it("hours", () => {
    expect(hourLabel("2026-11-18T17:00:00Z")).toBe("14 h");
    expect(hourLabel("2026-11-18T03:00:00Z")).toBe("0 h");
  });

  it("days", () => {
    expect(dayLabel("2026-11-17")).toBe("mar 17/11");
    expect(dayLabel("2026-11-22")).toBe("dom 22/11");
  });

  it("when a peak happened", () => {
    const now = "2026-11-18T20:00:00Z";
    expect(peakWhen({ users: 3, at: "2026-11-18T17:35:00Z" }, now)).toBe("a las 14:35");
    expect(peakWhen({ users: 3, at: "2026-11-17T22:10:00Z" }, now)).toBe("el mar 17/11 a las 19:10");
    // 01:00 UTC on the 18th is still the 17th in Buenos Aires.
    expect(peakWhen({ users: 3, at: "2026-11-18T01:00:00Z" }, now)).toBe("el mar 17/11 a las 22:00");
  });

  it("students", () => {
    expect(students(1)).toBe("1 alumno");
    expect(plain(students(1200))).toBe("1.200 alumnos");
  });
});

describe("latencyLevel", () => {
  it("fast, slow, failed", () => {
    expect(latencyLevel(85)).toBe("ok");
    expect(latencyLevel(1200)).toBe("warn");
    expect(latencyLevel(2500)).toBe("bad");
    expect(latencyLevel(null)).toBe("bad");
    expect(latencyLevel(100, false)).toBe("bad");
  });
});

describe("toUsage", () => {
  it("reads the jsonb of admin_uso()", () => {
    const u = toUsage({
      checked_at: "2026-11-18T20:00:00+00:00",
      online_now: 2,
      active_24h: 10,
      active_7d: 30,
      active_30d: 50,
      users: 60,
      by_career: [
        { name: "Ing. Industrial", users: 40, no_plan: false },
        { name: "Sin plan", users: 5, no_plan: true },
      ],
      peak_today: { users: 4, at: "2026-11-18T17:35:00+00:00" },
      peak_7d: null,
      hourly: [{ at: "2026-11-18T19:00:00+00:00", users: 3 }],
      daily: [{ day: "2026-11-18", users: 10 }],
      db_bytes: 1024,
      db_limit_bytes: 524288000,
      tables: [{ name: "subjects", bytes: 512 }],
    });
    expect(u.onlineNow).toBe(2);
    expect(u.byCareer[1]).toEqual({ name: "Sin plan", users: 5, noPlan: true });
    expect(u.peakToday).toEqual({ users: 4, at: "2026-11-18T17:35:00+00:00" });
    expect(u.peak7d).toBeNull();
    expect(u.hourly).toHaveLength(1);
    expect(u.dbLimitBytes).toBe(524288000);
    expect(u.tables[0].name).toBe("subjects");
  });

  it("survives missing fields", () => {
    const u = toUsage({});
    expect(u.users).toBe(0);
    expect(u.byCareer).toEqual([]);
    expect(u.dbLimitBytes).toBe(500 * 1024 * 1024);
    expect(u.peakToday).toBeNull();
  });
});

describe("Vercel deployments", () => {
  it("keeps only state, target, branch and date", () => {
    const [d] = toDeployments({
      deployments: [
        {
          uid: "dpl_1",
          url: "x.vercel.app",
          readyState: "READY",
          target: "production",
          created: 1763490000000,
          creator: { email: "someone@example.com", username: "someone" },
          meta: { githubCommitRef: "main", githubCommitAuthorName: "Someone" },
        },
      ],
    });
    expect(d).toEqual({ id: "dpl_1", state: "READY", production: true, branch: "main", createdAt: 1763490000000 });
    expect(JSON.stringify(d)).not.toContain("someone");
  });

  it("handles an unexpected body", () => {
    expect(toDeployments(null)).toEqual([]);
    expect(toDeployments({ deployments: "x" })).toEqual([]);
  });

  it("states in Spanish", () => {
    expect(deploymentState("READY")).toEqual({ label: "Publicado", level: "ok" });
    expect(deploymentState("ERROR").level).toBe("bad");
    expect(deploymentState("WEIRD").label).toBe("weird");
  });
});
