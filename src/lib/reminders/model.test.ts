import { describe, expect, it } from "vitest";
import { reminderKey } from "./model";

// Which mail is due is tested in the database (tools/db-test/security.sql, avisos_debido()) and
// the mail itself in apps-script.test.ts.
describe("natural key", () => {
  const base = { planId: "industrial-2023", code: "CB002", name: "MESA 01", kind: "Regular", date: "2026-12-09" };

  it("is the same for the same table after the daily sync", () => {
    expect(reminderKey({ ...base })).toBe(reminderKey(base));
  });

  it("differs by day, name, kind or plan", () => {
    const key = reminderKey(base);
    expect(reminderKey({ ...base, date: "2026-12-10" })).not.toBe(key);
    expect(reminderKey({ ...base, name: "MESA 02" })).not.toBe(key);
    expect(reminderKey({ ...base, kind: "Libre" })).not.toBe(key);
    expect(reminderKey({ ...base, planId: "civil-2023" })).not.toBe(key);
  });

  it("does not mix fields that contain spaces", () => {
    expect(reminderKey({ ...base, code: "CB 002", name: "MESA" })).not.toBe(reminderKey({ ...base, code: "CB", name: "002 MESA" }));
  });
});
