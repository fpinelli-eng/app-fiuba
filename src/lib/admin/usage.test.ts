import { describe, expect, it } from "vitest";
import {
  dateTimeLabel,
  dayLabel,
  deploymentState,
  formatBytes,
  formatPercent,
  latencyLevel,
  percent,
  storageLevel,
  timeLabel,
  toAdminUser,
  toDeployments,
  toUsage,
} from "./usage";

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

describe("labels in Buenos Aires time", () => {
  it("days", () => {
    expect(dayLabel("2026-11-17")).toBe("mar 17/11");
    expect(dayLabel("2026-11-22")).toBe("dom 22/11");
  });

  it("times", () => {
    expect(timeLabel("2026-11-18T17:35:00Z")).toBe("14:35");
    expect(timeLabel("2026-11-18T03:05:00Z")).toBe("00:05");
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

const ana = {
  full_name: "Ana",
  email: "ana@fi.uba.ar",
  plan_id: "industrial-2023",
  plan: "Ing. Industrial 2023",
  created_at: "2026-11-01T12:00:00+00:00",
  intro_seen: true,
  subjects: 3,
  plan_courses: 2,
  signup_source: "qr",
  last_seen: "2026-11-19T21:07:42.123+00:00",
};

/** A row of admin_users() or of admin_uso() before 20261121150000: no last_seen. */
const older = (): Record<string, unknown> => {
  const row: Record<string, unknown> = { ...ana };
  delete row.last_seen;
  return row;
};

describe("toUsage", () => {
  it("reads the jsonb of admin_uso(), with the students", () => {
    const u = toUsage({
      checked_at: "2026-11-19T20:00:00+00:00",
      active_24h: 10,
      active_7d: 30,
      active_30d: 50,
      users: 60,
      by_career: [
        { id: "industrial", name: "Ing. Industrial", users: 40, active_7d: 12, no_plan: false },
        { name: "Sin plan", users: 5, no_plan: true },
      ],
      db_bytes: 1024,
      db_limit_bytes: 524288000,
      review_authors: 7,
      people: [ana],
    });
    expect(u.active24h).toBe(10);
    expect(u.byCareer[0]).toEqual({ id: "industrial", name: "Ing. Industrial", users: 40, active7d: 12, noPlan: false });
    // Older admin_uso(): no id and no active count per career.
    expect(u.byCareer[1]).toEqual({ id: null, name: "Sin plan", users: 5, active7d: null, noPlan: true });
    expect(u.dbLimitBytes).toBe(524288000);
    expect(u.reviewAuthors).toBe(7);
    expect(u.people).toEqual([
      {
        fullName: "Ana",
        email: "ana@fi.uba.ar",
        planId: "industrial-2023",
        plan: "Ing. Industrial 2023",
        createdAt: "2026-11-01T12:00:00+00:00",
        introSeen: true,
        subjects: 3,
        planCourses: 2,
        signupSource: "qr",
        lastSeen: "2026-11-19T21:07:42.123+00:00",
      },
    ]);
  });

  it("tolerates the older shape: extra fields ignored, no students", () => {
    const u = toUsage({
      checked_at: "2026-11-18T20:00:00+00:00",
      online_now: 2,
      active_24h: 10,
      users: 60,
      peak_today: { users: 4, at: "2026-11-18T17:35:00+00:00" },
      hourly: [{ at: "2026-11-18T19:00:00+00:00", users: 3 }],
      daily: [{ day: "2026-11-18", users: 10 }],
      db_bytes: 1024,
      tables: [{ name: "subjects", bytes: 512 }],
    });
    expect(u.active24h).toBe(10);
    expect(u.people).toBeNull();
    expect(u.reviewAuthors).toBeNull();
    expect(Object.keys(u)).not.toContain("onlineNow");
  });

  it("survives missing fields", () => {
    const u = toUsage({});
    expect(u.users).toBe(0);
    expect(u.byCareer).toEqual([]);
    expect(u.dbLimitBytes).toBe(500 * 1024 * 1024);
    expect(u.people).toBeNull();
  });
});

describe("toAdminUser", () => {
  it("reads a row of admin_users() too, ignoring its last_seen_at rounded to the day", () => {
    const u = toAdminUser({ ...older(), plan: undefined, subjects: "3", plan_id: null, signup_source: null, last_seen_at: "2026-11-19T03:00:00+00:00" });
    expect(u.subjects).toBe(3);
    expect(u.planId).toBeNull();
    expect(u.plan).toBeNull();
    expect(u.signupSource).toBeNull();
    expect(u.lastSeen).toBeNull();
    expect(Object.keys(u)).not.toContain("lastSeenAt");
  });

  it("reads the last use of admin_uso(), or null before the migration or when unknown", () => {
    expect(toAdminUser(ana).lastSeen).toBe("2026-11-19T21:07:42.123+00:00");
    expect(toAdminUser({ ...ana, last_seen: null }).lastSeen).toBeNull();
    expect(toAdminUser(older()).lastSeen).toBeNull();
  });
});

describe("dateTimeLabel", () => {
  it("is the exact date and time in Buenos Aires, dd/mm/aaaa HH:MM", () => {
    expect(dateTimeLabel("2026-11-19T21:07:42.123+00:00")).toBe("19/11/2026 18:07");
    // After midnight UTC it is still the previous day in Buenos Aires (UTC−3).
    expect(dateTimeLabel("2026-11-20T02:30:00Z")).toBe("19/11/2026 23:30");
    expect(dateTimeLabel("2026-01-05T03:04:00Z")).toBe("05/01/2026 00:04");
  });

  it("never uses relative words, even for right now", () => {
    const label = dateTimeLabel(new Date().toISOString());
    expect(label).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(label).not.toMatch(/hoy|ayer|hace/i);
  });

  it("shows a dash when unknown", () => {
    expect(dateTimeLabel(null)).toBe("—");
    expect(dateTimeLabel("")).toBe("—");
    expect(dateTimeLabel("no es una fecha")).toBe("—");
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
