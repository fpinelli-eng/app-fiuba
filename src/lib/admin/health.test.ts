import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HEALTH_LIMITS, ago, healthItems, toHealth } from "./health";

const H = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-20T15:00:00Z");
const at = (hours: number) => new Date(NOW - hours * H).toISOString();

const row = (over: Record<string, unknown> = {}) =>
  toHealth({
    checked_at: at(0),
    exam_sync_at: at(5),
    exam_oldest_plan_sync_at: at(30),
    news_fetched_at: at(10),
    reminders_due: 0,
    reminders_due_since: null,
    offers_pending: 1,
    last_seen_at: at(0.2),
    users: 120,
    reviews: 40,
    monitor_checked_at: at(0.5),
    ...over,
  });

const status = (over: Record<string, unknown> = {}) => Object.fromEntries(healthItems(row(over), NOW).map((c) => [c.key, c.ok]));

describe("ago", () => {
  it("human ages", () => {
    expect(ago(at(0), NOW)).toBe("recién");
    expect(ago(at(0.5), NOW)).toBe("hace 30 min");
    expect(ago(at(3), NOW)).toBe("hace 3 h");
    expect(ago(at(72), NOW)).toBe("hace 3 días");
    expect(ago(null, NOW)).toBe("nunca");
  });
});

describe("healthItems", () => {
  it("all fine", () => {
    expect(status()).toEqual({ monitor: true, examenes: true, noticias: true, recordatorios: true });
    expect(healthItems(row(), NOW)[0].detail).toBe("Último chequeo del monitor: hace 30 min.");
  });

  it("the monitor stopped after 2 h, or never ran", () => {
    expect(status({ monitor_checked_at: at(3) }).monitor).toBe(false);
    expect(healthItems(row({ monitor_checked_at: null }), NOW)[0].detail).toBe("El monitor no está corriendo. Último chequeo: nunca.");
  });

  it("same limits as the Apps Script", () => {
    expect(status({ exam_sync_at: at(37) }).examenes).toBe(false);
    expect(status({ news_fetched_at: at(49) }).noticias).toBe(false);
    expect(status({ reminders_due: 3, reminders_due_since: at(2) }).recordatorios).toBe(true);
    expect(status({ reminders_due: 3, reminders_due_since: at(4) }).recordatorios).toBe(false);
    const gs = readFileSync(join(process.cwd(), "tools/reminders/apps-script/Salud.gs"), "utf8");
    expect(gs).toContain(`examHours: ${HEALTH_LIMITS.examHours},`);
    expect(gs).toContain(`newsHours: ${HEALTH_LIMITS.newsHours},`);
    expect(gs).toContain(`reminderHours: ${HEALTH_LIMITS.reminderHours},`);
  });
});
