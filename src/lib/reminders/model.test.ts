import { describe, expect, it } from "vitest";
import { buenosAiresMoment, currentTablesByKey, dueMail, previousDay, reminderKey, type CurrentTable } from "./model";

const table = (over: Partial<CurrentTable> = {}): CurrentTable => ({
  planId: "industrial-2023",
  code: "CB002",
  name: "MESA 01",
  kind: "Regular",
  date: "2026-12-09",
  enrollFrom: "2026-11-30T14:00",
  enrollTo: "2026-12-07T23:59",
  startTime: "17:00",
  endTime: "20:00",
  ...over,
});

const fresh = { createdAt: "2026-11-20T10:00", firstSent: false };

describe("buenosAiresMoment", () => {
  it("uses Buenos Aires time (UTC−3), also across midnight", () => {
    expect(buenosAiresMoment(new Date("2026-11-30T11:00:00Z"))).toBe("2026-11-30T08:00");
    expect(buenosAiresMoment(new Date("2026-12-01T02:30:00Z"))).toBe("2026-11-30T23:30");
  });
});

describe("previousDay", () => {
  it("goes back across months and years", () => {
    expect(previousDay("2027-03-01")).toBe("2027-02-28");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
  });
});

describe("natural key", () => {
  it("matches a reminder with the same table after the daily sync (new ids, new times)", () => {
    const now = currentTablesByKey([table({ enrollFrom: "2026-12-01T08:00" }), table({ code: "CB001" })]);
    const found = now.get(reminderKey({ planId: "industrial-2023", code: "CB002", name: "MESA 01", kind: "Regular", date: "2026-12-09" }));
    expect(found?.enrollFrom).toBe("2026-12-01T08:00");
  });

  it("does not match another day, name, kind or plan", () => {
    const now = currentTablesByKey([table()]);
    const base = { planId: "industrial-2023", code: "CB002", name: "MESA 01", kind: "Regular", date: "2026-12-09" };
    expect(now.has(reminderKey({ ...base, date: "2026-12-10" }))).toBe(false);
    expect(now.has(reminderKey({ ...base, name: "MESA 02" }))).toBe(false);
    expect(now.has(reminderKey({ ...base, kind: "Libre" }))).toBe(false);
    expect(now.has(reminderKey({ ...base, planId: "civil-2023" }))).toBe(false);
  });

  it("keeps the widest window when the SIU lists a table twice", () => {
    const now = currentTablesByKey([table({ enrollTo: "2026-12-06T23:59" }), table({ enrollFrom: "2026-12-01T08:00" })]);
    expect(now.size).toBe(1);
    const t = [...now.values()][0];
    expect([t.enrollFrom, t.enrollTo]).toEqual(["2026-11-30T14:00", "2026-12-07T23:59"]);
  });
});

describe("dueMail", () => {
  const t = table();

  it("sends nothing before the enrollment opens", () => {
    expect(dueMail(fresh, t, "2026-11-29T20:00")).toBeNull();
    expect(dueMail(fresh, t, "2026-11-30T09:00")).toBeNull(); // opens at 14:00
  });

  it("sends the first mail once it opened, never before 08:00", () => {
    expect(dueMail(fresh, t, "2026-11-30T14:17")).toBe("first");
    const early = table({ enrollFrom: "2026-11-30T00:00" });
    expect(dueMail(fresh, early, "2026-11-30T05:17")).toBeNull();
    expect(dueMail(fresh, early, "2026-11-30T08:17")).toBe("first");
  });

  it("catches up later in the window if the bot missed the first day, but not at night", () => {
    expect(dueMail(fresh, t, "2026-12-03T11:17")).toBe("first");
    expect(dueMail(fresh, t, "2026-12-03T02:17")).toBeNull();
    expect(dueMail(fresh, t, "2026-12-07T05:17")).toBeNull();
  });

  it("does not repeat the first mail", () => {
    expect(dueMail({ ...fresh, firstSent: true }, t, "2026-12-03T11:17")).toBeNull();
  });

  it("skips the mail when the student asked with the enrollment already open", () => {
    expect(dueMail({ ...fresh, createdAt: "2026-12-02T10:00" }, t, "2026-12-03T11:17")).toBeNull();
    expect(dueMail({ ...fresh, createdAt: "2026-12-02T10:00" }, t, "2026-12-07T08:17")).toBeNull();
  });

  it("never sends a last-day mail", () => {
    const sent = { ...fresh, firstSent: true };
    expect(dueMail(sent, t, "2026-12-07T08:17")).toBeNull();
    expect(dueMail(sent, t, "2026-12-07T20:17")).toBeNull();
  });

  it("sends nothing once it closed", () => {
    expect(dueMail(fresh, t, "2026-12-08T08:17")).toBeNull();
    expect(dueMail(fresh, table({ enrollTo: "2026-12-07T14:00" }), "2026-12-07T14:17")).toBeNull();
  });

  it("sends the mail when the window is one day", () => {
    const oneDay = table({ enrollFrom: "2026-12-07T08:00", enrollTo: "2026-12-07T23:59" });
    expect(dueMail(fresh, oneDay, "2026-12-07T08:17")).toBe("first");
  });

  it("waits for the opening hour, also on a day that opens in the afternoon", () => {
    const late = table({ enrollFrom: "2026-12-08T14:00", enrollTo: "2026-12-09T09:00" });
    expect(dueMail(fresh, late, "2026-12-08T08:17")).toBeNull();
    expect(dueMail(fresh, late, "2026-12-08T14:17")).toBe("first");
  });

  it("sends nothing when the table is gone or has no dates", () => {
    expect(dueMail(fresh, null, "2026-12-03T11:17")).toBeNull();
    expect(dueMail(fresh, table({ enrollFrom: null, enrollTo: null }), "2026-12-03T11:17")).toBeNull();
    expect(dueMail(fresh, table({ enrollFrom: null }), "2026-12-07T08:17")).toBeNull();
  });
});
