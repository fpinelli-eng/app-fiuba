import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SLOW_MS,
  chartTop,
  dateTimeLabel,
  durationLabel,
  incidentDuration,
  latencySlots,
  latencySummary,
  secondsLabel,
  toMonitorHistory,
} from "./incidents";

const H = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-20T15:00:00Z"); // 12:00 in Buenos Aires
const at = (hours: number) => new Date(NOW - hours * H).toISOString();

describe("toMonitorHistory", () => {
  it("reads admin_monitor(), newest incident first, and drops broken rows", () => {
    const h = toMonitorHistory({
      checked_at: at(0),
      latency: [{ at: at(2), ms: 400 }, { at: "nope", ms: 1 }, { at: at(1), ms: null }, { at: at(1), ms: "650" }],
      incidents: [
        { id: 1, kind: "db_down", title: "La base no responde", detail: null, started_at: at(30), ended_at: at(29), max_ms: 30000 },
        { id: 2, kind: "db_slow", title: "La base está lenta", detail: "salud() tardó 12,0 s.", started_at: at(3), ended_at: null, max_ms: 12000 },
        { id: 3, kind: "raro", title: "x", started_at: at(5) },
        { id: 4, kind: "other", title: "sin fecha" },
      ],
    });
    expect(h.latency).toEqual([{ at: at(2), ms: 400 }, { at: at(1), ms: 650 }]);
    expect(h.incidents.map((i) => i.id)).toEqual([2, 3, 1]);
    expect(h.incidents[0]).toMatchObject({ kind: "db_slow", endedAt: null, maxMs: 12000 });
    expect(h.incidents[1].kind).toBe("other");
    expect(toMonitorHistory({}).incidents).toEqual([]);
  });
});

describe("latency chart", () => {
  it("one slot per hour ending now, the slowest sample in each, gaps as null", () => {
    const slots = latencySlots([{ at: at(0.5), ms: 300 }, { at: at(0.2), ms: 900 }, { at: at(5.5), ms: 12_000 }, { at: at(80), ms: 1 }], NOW);
    expect(slots).toHaveLength(72);
    expect(slots[71]).toEqual({ start: NOW - H, ms: 900 });
    expect(slots[66].ms).toBe(12_000);
    expect(slots[0].start).toBe(NOW - 72 * H);
    expect(slots.filter((s) => s.ms !== null)).toHaveLength(2);
  });

  it("top of the chart: at least twice the limit, whole seconds above", () => {
    expect(chartTop(latencySlots([{ at: at(1), ms: 400 }], NOW))).toBe(6000);
    expect(chartTop(latencySlots([{ at: at(1), ms: 12_300 }], NOW))).toBe(13_000);
    expect(chartTop([])).toBe(2 * SLOW_MS);
  });

  it("summary: median, maximum, hours over 3 s and hours without data", () => {
    const slots = latencySlots([400, 500, 12_000].map((ms, i) => ({ at: at(i + 0.5), ms })), NOW);
    expect(latencySummary(slots)).toEqual({ median: 500, max: 12_000, slow: 1, missing: 69 });
    expect(latencySummary(latencySlots([], NOW))).toEqual({ median: null, max: null, slow: 0, missing: 72 });
  });

  it("same limit as the Apps Script", () => {
    const gs = readFileSync(join(process.cwd(), "tools/reminders/apps-script/Salud.gs"), "utf8");
    expect(gs).toContain(`slowMs: ${SLOW_MS},`);
  });
});

describe("labels", () => {
  it("seconds", () => {
    expect(secondsLabel(412)).toBe("0,4 s");
    expect(secondsLabel(12_345)).toBe("12,3 s");
  });

  it("durations", () => {
    expect(durationLabel(30_000)).toBe("menos de 1 min");
    expect(durationLabel(45 * 60_000)).toBe("45 min");
    expect(durationLabel(2 * H)).toBe("2 h");
    expect(durationLabel(2 * H + 15 * 60_000)).toBe("2 h 15 min");
    expect(durationLabel(24 * H)).toBe("1 día");
    expect(durationLabel(76 * H)).toBe("3 días 4 h");
  });

  it("an ongoing incident lasts until now", () => {
    const base = { id: 1, kind: "db_down" as const, title: "La base no responde", detail: null, maxMs: null };
    expect(incidentDuration({ ...base, startedAt: at(3), endedAt: at(1) }, NOW)).toBe("2 h");
    expect(incidentDuration({ ...base, startedAt: at(0.75), endedAt: null }, NOW)).toBe("45 min");
  });

  it("date and time in Buenos Aires", () => {
    expect(dateTimeLabel("2026-11-20T02:30:00Z")).toBe("jue 19/11 23:30");
  });
});
