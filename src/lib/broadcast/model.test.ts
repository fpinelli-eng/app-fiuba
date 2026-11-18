import { describe, expect, it } from "vitest";
import {
  addDismissed,
  base64UrlToBytes,
  buildPushPayload,
  canUseBroadcasts,
  cleanUrl,
  countReach,
  detectIOS,
  endOfDayBuenosAires,
  isGoneStatus,
  parseDismissed,
  pickAnnouncement,
  pushState,
  validateAnnouncement,
  validatePush,
  type Announcement,
  type PushEnvironment,
} from "./model";

const now = new Date("2026-11-18T15:00:00Z");
const careers = ["industrial", "informatica"];

describe("canUseBroadcasts", () => {
  it("only admins while they try it", () => {
    expect(canUseBroadcasts({ isAdmin: true })).toBe(true);
    expect(canUseBroadcasts({ isAdmin: false })).toBe(false);
  });
});

describe("cleanUrl", () => {
  it("takes app paths and https addresses", () => {
    expect(cleanUrl("")).toEqual({ url: null });
    expect(cleanUrl(" /finales ")).toEqual({ url: "/finales" });
    expect(cleanUrl("https://www.fi.uba.ar/noticias")).toEqual({ url: "https://www.fi.uba.ar/noticias" });
  });
  it("refuses anything else", () => {
    for (const bad of ["javascript:alert(1)", "http://example.com", "//otro.sitio", "/\\otro.sitio", "finales", "data:text/html,hi"]) {
      expect(cleanUrl(bad)).toHaveProperty("error");
    }
    expect(cleanUrl(`https://a.com/${"x".repeat(600)}`)).toHaveProperty("error");
  });
});

describe("validateAnnouncement", () => {
  const base = { title: " Inscripción  a verano ", body: "Del 9 al 14.", url: "", careerId: "", endsOn: "" };
  it("cleans the text and leaves the optional fields empty", () => {
    expect(validateAnnouncement(base, careers, now)).toEqual({
      draft: { title: "Inscripción a verano", body: "Del 9 al 14.", url: null, career_id: null, ends_at: null },
    });
  });
  it("targets a career and ends at the end of the day in Buenos Aires", () => {
    const r = validateAnnouncement({ ...base, careerId: "industrial", endsOn: "2026-11-20" }, careers, now);
    expect("draft" in r && r.draft.career_id).toBe("industrial");
    expect("draft" in r && r.draft.ends_at).toBe("2026-11-21T02:59:59.999Z");
  });
  it("refuses what is missing, too long, unknown or past", () => {
    expect(validateAnnouncement({ ...base, title: "  " }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, body: "" }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, title: "x".repeat(81) }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, body: "x".repeat(281) }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, careerId: "medicina" }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, endsOn: "2026-11-17" }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, endsOn: "mañana" }, careers, now)).toHaveProperty("error");
    expect(validateAnnouncement({ ...base, url: "javascript:x" }, careers, now)).toHaveProperty("error");
  });
  it("today still counts until midnight", () => {
    expect(validateAnnouncement({ ...base, endsOn: "2026-11-18" }, careers, now)).toHaveProperty("draft");
  });
});

describe("endOfDayBuenosAires", () => {
  it("is 23:59 at UTC-3", () => {
    expect(endOfDayBuenosAires("2026-12-31")).toBe("2027-01-01T02:59:59.999Z");
  });
});

describe("pickAnnouncement", () => {
  const a = (id: number, more: Partial<Announcement> = {}): Announcement => ({
    id,
    title: `Aviso ${id}`,
    body: "Texto",
    url: null,
    careerId: null,
    endsAt: null,
    createdAt: `2026-11-1${id}T12:00:00Z`,
    ...more,
  });
  it("shows the newest active one", () => {
    expect(pickAnnouncement([a(1), a(3), a(2)], "industrial", [], now)?.id).toBe(3);
  });
  it("skips ended, closed and other careers", () => {
    const list = [a(1), a(2, { endsAt: "2026-11-18T10:00:00Z" }), a(3, { careerId: "informatica" }), a(4)];
    expect(pickAnnouncement(list, "industrial", [4], now)?.id).toBe(1);
    expect(pickAnnouncement(list, "informatica", [4], now)?.id).toBe(3);
    expect(pickAnnouncement(list, null, [1, 4], now)).toBeNull();
  });
  it("keeps one that ends later", () => {
    expect(pickAnnouncement([a(1, { endsAt: "2026-11-19T00:00:00Z" })], null, [], now)?.id).toBe(1);
  });
});

describe("dismissed cookie", () => {
  it("reads ids and ignores junk", () => {
    expect(parseDismissed(undefined)).toEqual([]);
    expect(parseDismissed("3.x.-1.7.1.5.2.5")).toEqual([3, 7, 1, 5, 2, 5]);
  });
  it("adds an id once and keeps the latest 20", () => {
    expect(addDismissed("3.7", 3)).toBe("7.3");
    const many = Array.from({ length: 20 }, (_, i) => i + 1).join(".");
    const next = parseDismissed(addDismissed(many, 99));
    expect(next).toHaveLength(20);
    expect(next[0]).toBe(2);
    expect(next.at(-1)).toBe(99);
  });
});

describe("validatePush", () => {
  const base = { title: "Mesas de diciembre", body: "Ya están las fechas.", url: "/finales", careerId: "" };
  it("defaults the link to Inicio", () => {
    expect(validatePush({ ...base, url: "" }, careers)).toEqual({
      draft: { title: "Mesas de diciembre", body: "Ya están las fechas.", url: "/", careerId: null },
    });
  });
  it("refuses a missing title, long text or another career", () => {
    expect(validatePush({ ...base, title: "" }, careers)).toHaveProperty("error");
    expect(validatePush({ ...base, title: "x".repeat(61) }, careers)).toHaveProperty("error");
    expect(validatePush({ ...base, body: "x".repeat(161) }, careers)).toHaveProperty("error");
    expect(validatePush({ ...base, careerId: "medicina" }, careers)).toHaveProperty("error");
    expect(validatePush({ ...base, url: "http://x.com" }, careers)).toHaveProperty("error");
  });
});

describe("buildPushPayload", () => {
  it("is the JSON the service worker reads", () => {
    expect(JSON.parse(buildPushPayload({ title: "Hola", body: "Texto", url: "/finales" }))).toEqual({
      title: "Hola",
      body: "Texto",
      url: "/finales",
      tag: "fiubi-aviso",
    });
  });
  it("fits easily under the 4 KB of a push", () => {
    expect(buildPushPayload({ title: "x".repeat(60), body: "é".repeat(160), url: `https://a.com/${"x".repeat(480)}` }).length).toBeLessThan(1500);
  });
});

describe("isGoneStatus", () => {
  it("is 404 and 410 only", () => {
    expect([404, 410, 400, 413, 429, 500, undefined].map(isGoneStatus)).toEqual([true, true, false, false, false, false, false]);
  });
});

describe("countReach", () => {
  const counts = [
    { careerId: "industrial", devices: 2 },
    { careerId: "informatica", devices: 1 },
    { careerId: null, devices: 1 },
  ];
  it("counts everyone or one career", () => {
    expect(countReach(counts, null)).toBe(4);
    expect(countReach(counts, "industrial")).toBe(2);
    expect(countReach(counts, "quimica")).toBe(0);
  });
});

describe("pushState", () => {
  const env: PushEnvironment = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    isIOS: false,
    iosVersion: null,
    standalone: false,
    configured: true,
    permission: "default",
    subscribed: false,
  };
  it("off, on and blocked", () => {
    expect(pushState(env)).toBe("off");
    expect(pushState({ ...env, permission: "granted", subscribed: true })).toBe("on");
    expect(pushState({ ...env, permission: "granted", subscribed: false })).toBe("off");
    expect(pushState({ ...env, permission: "denied" })).toBe("denied");
  });
  it("says when the server has no keys or the browser has no push", () => {
    expect(pushState({ ...env, configured: false })).toBe("unconfigured");
    expect(pushState({ ...env, hasPushManager: false })).toBe("unsupported");
  });
  it("on the iPhone asks to install it first, and needs iOS 16.4", () => {
    const ios = { ...env, isIOS: true, iosVersion: 1702, hasPushManager: false };
    expect(pushState(ios)).toBe("ios-install");
    expect(pushState({ ...ios, standalone: true, hasPushManager: true })).toBe("off");
    expect(pushState({ ...ios, standalone: true, iosVersion: 1603 })).toBe("ios-old");
    expect(pushState({ ...ios, standalone: true, iosVersion: null })).toBe("ios-old");
  });
});

describe("detectIOS", () => {
  it("reads iPhone, iPad and iPadOS", () => {
    expect(detectIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1", 5)).toEqual({ isIOS: true, version: 1702 });
    expect(detectIOS("Mozilla/5.0 (iPad; CPU OS 16_3 like Mac OS X)", 5)).toEqual({ isIOS: true, version: 1603 });
    expect(detectIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15", 5)).toEqual({ isIOS: true, version: 1801 });
  });
  it("a Mac or Android is not iOS", () => {
    expect(detectIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.1 Safari/605.1.15", 0).isIOS).toBe(false);
    expect(detectIOS("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile Safari/537.36", 5).isIOS).toBe(false);
  });
});

describe("base64UrlToBytes", () => {
  it("decodes base64url without padding", () => {
    expect([...base64UrlToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
