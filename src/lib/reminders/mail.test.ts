import { describe, expect, it } from "vitest";
import { confirmRequest } from "./instant";
import { confirmationDue, normalizeReminderEmail, reminderDestination, type ReminderMailState } from "./mail";

const ACCOUNT = "Ana@fi.uba.ar";
const NOW = Date.parse("2026-11-20T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600 * 1000).toISOString();
const state = (over: Partial<ReminderMailState> = {}): ReminderMailState => ({ account: ACCOUNT, custom: null, confirmations: [], ...over });

describe("normalizeReminderEmail", () => {
  it("trims and lowercases; any domain", () => {
    expect(normalizeReminderEmail("  Ana.Perez+fiubi@GMAIL.com ", ACCOUNT)).toEqual({ email: "ana.perez+fiubi@gmail.com" });
    expect(normalizeReminderEmail("ana@outlook.com.ar", ACCOUNT)).toEqual({ email: "ana@outlook.com.ar" });
  });

  it("empty or the account itself clears it", () => {
    expect(normalizeReminderEmail("", ACCOUNT)).toEqual({ email: null });
    expect(normalizeReminderEmail("   ", ACCOUNT)).toEqual({ email: null });
    expect(normalizeReminderEmail(null, ACCOUNT)).toEqual({ email: null });
    expect(normalizeReminderEmail("ANA@FI.UBA.AR", ACCOUNT)).toEqual({ email: null });
  });

  it("rejects what is not one plain address", () => {
    for (const bad of ["ana", "ana@gmail", "@gmail.com", "ana perez@gmail.com", "a@gmail.com, b@gmail.com", "a@gmail.com;b@gmail.com", "<a@gmail.com>", "a@@gmail.com", "a@gmail.c", "a..b@gmail.com", ".a@gmail.com", "a.@gmail.com", "a@-gmail.com", "a@gmail-.com", "a@gmail..com", `${"a".repeat(65)}@gmail.com`, `a@${"b".repeat(250)}.com`]) {
      expect(normalizeReminderEmail(bad, ACCOUNT), bad).toHaveProperty("error");
    }
  });
});

describe("confirmationDue", () => {
  it("the first time the student has reminders", () => {
    expect(reminderDestination(state())).toBe("ana@fi.uba.ar");
    expect(confirmationDue(state(), 1, NOW)).toBe(true);
    expect(confirmationDue(state(), 0, NOW)).toBe(false);
  });

  it("not again to the same address, also after removing every reminder", () => {
    const s = state({ confirmations: [{ email: "ana@fi.uba.ar", sentAt: hoursAgo(200) }] });
    expect(confirmationDue(s, 3, NOW)).toBe(false);
  });

  it("again when the address changes, the newest confirmation decides", () => {
    const s = state({
      custom: "ana@gmail.com",
      confirmations: [
        { email: "ana@gmail.com", sentAt: hoursAgo(100) },
        { email: "ana@fi.uba.ar", sentAt: hoursAgo(2) },
      ],
    });
    expect(reminderDestination(s)).toBe("ana@gmail.com");
    expect(confirmationDue(s, 1, NOW)).toBe(true);
  });

  it("at most 3 in 24 hours", () => {
    const confirmations = [hoursAgo(1), hoursAgo(5), hoursAgo(20)].map((sentAt, i) => ({ email: `ana${i}@gmail.com`, sentAt }));
    expect(confirmationDue(state({ custom: "otra@gmail.com", confirmations }), 1, NOW)).toBe(false);
    confirmations[2].sentAt = hoursAgo(25);
    expect(confirmationDue(state({ custom: "otra@gmail.com", confirmations }), 1, NOW)).toBe(true);
  });
});

describe("confirmRequest (instant path)", () => {
  const url = "https://script.google.com/macros/s/abc/exec";
  const token = "t".repeat(64);

  it("only with both variables", () => {
    expect(confirmRequest({})).toBeNull();
    expect(confirmRequest({ AVISOS_WEBAPP_URL: url })).toBeNull();
    expect(confirmRequest({ AVISOS_WEBAPP_TOKEN: token })).toBeNull();
  });

  it("only to Google's script host, so the token goes nowhere else", () => {
    expect(confirmRequest({ AVISOS_WEBAPP_URL: "https://example.com/exec", AVISOS_WEBAPP_TOKEN: token })).toBeNull();
    expect(confirmRequest({ AVISOS_WEBAPP_URL: "http://script.google.com/macros/s/abc/exec", AVISOS_WEBAPP_TOKEN: token })).toBeNull();
  });

  it("posts the token and the action as JSON", () => {
    const req = confirmRequest({ AVISOS_WEBAPP_URL: ` ${url} `, AVISOS_WEBAPP_TOKEN: token })!;
    expect(req.url).toBe(url);
    expect(req.init.method).toBe("POST");
    expect(JSON.parse(req.init.body as string)).toEqual({ token, action: "confirm" });
  });
});
