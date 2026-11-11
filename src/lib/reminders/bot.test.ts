import { describe, expect, it } from "vitest";
import { planRun, type Dump, type DumpReminder, type DumpTable } from "./bot";

const reminder = (over: Partial<DumpReminder> = {}): DumpReminder => ({
  id: 1,
  email: "ana@fi.uba.ar",
  plan_id: "industrial-2023",
  code: "CB002",
  name: "MESA 01",
  kind: "Regular",
  date: "2026-12-09",
  subject_name: "Álgebra Lineal",
  created_at: "2026-11-20T10:00",
  first_sent: false,
  last_sent: false,
  ...over,
});

const table = (over: Partial<DumpTable> = {}): DumpTable => ({
  plan_id: "industrial-2023",
  code: "CB002",
  name: "MESA 01",
  kind: "Regular",
  date: "2026-12-09",
  enroll_from: "2026-11-30T08:00",
  enroll_to: "2026-12-07T23:59",
  start_time: "17:00",
  end_time: null,
  ...over,
});

describe("planRun", () => {
  it("re-reads the current table: uses the dates the SIU has now", () => {
    const dump: Dump = { reminders: [reminder()], tables: [table({ enroll_from: "2026-12-01T08:00" })] };
    expect(planRun(dump, "2026-11-30T11:17").mails).toHaveLength(0);
    const run = planRun(dump, "2026-12-01T08:17");
    expect(run.mails.map((m) => [m.id, m.which, m.to])).toEqual([[1, "first", "ana@fi.uba.ar"]]);
    expect(run.mails[0].subject).toBe("Abrió la inscripción al final de Álgebra Lineal");
    expect(run.counts).toEqual({ pending: 1, first: 1, last: 0, missing: 0 });
  });

  it("skips (and keeps) reminders whose table is gone", () => {
    const run = planRun({ reminders: [reminder()], tables: [table({ date: "2026-12-10" })] }, "2026-12-01T08:17");
    expect(run.mails).toHaveLength(0);
    expect(run.counts.missing).toBe(1);
  });

  it("sends the last-day mail", () => {
    const run = planRun({ reminders: [reminder({ first_sent: true })], tables: [table()] }, "2026-12-07T08:17");
    expect(run.mails.map((m) => m.which)).toEqual(["last"]);
  });

  it("never mails an address outside fi.uba.ar", () => {
    const run = planRun({ reminders: [reminder({ email: "x@gmail.com" })], tables: [table()] }, "2026-12-01T08:17");
    expect(run.mails).toHaveLength(0);
  });
});
