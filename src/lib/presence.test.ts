import { describe, expect, it } from "vitest";
import { browserPresenceKey, presenceTopic, summarizeOnline } from "./presence";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("presenceTopic", () => {
  it("is one channel per plan", () => {
    expect(presenceTopic("informatica-2023")).toBe("presencia:informatica-2023");
  });
});

describe("browserPresenceKey", () => {
  it("creates a random key once and then reuses it", () => {
    const storage = memoryStorage();
    expect(browserPresenceKey(storage, () => "abcdef123456")).toBe("abcdef123456");
    expect(browserPresenceKey(storage, () => "otherkey9999")).toBe("abcdef123456");
  });

  it("ignores a tampered value", () => {
    const storage = memoryStorage({ fiubi_presencia: "<script>" });
    expect(browserPresenceKey(storage, () => "abcdef123456")).toBe("abcdef123456");
  });

  it("falls back to a key per tab when storage fails", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(browserPresenceKey(broken, () => "tabkey123456")).toBe("tabkey123456");
    expect(browserPresenceKey(null, () => "tabkey654321")).toBe("tabkey654321");
  });
});

describe("summarizeOnline", () => {
  const careers = new Map([
    ["informatica-2023", { id: "informatica", name: "Ing. en Informática" }],
    ["informatica-1986", { id: "informatica", name: "Ing. en Informática" }],
    ["civil-2023", { id: "civil", name: "Ing. Civil" }],
  ]);

  it("adds the plans of a career and sorts by count", () => {
    const s = summarizeOnline({ "civil-2023": ["a"], "informatica-2023": ["b", "c"], "informatica-1986": ["d"] }, careers);
    expect(s.total).toBe(4);
    expect(s.byCareer).toEqual([
      { id: "informatica", name: "Ing. en Informática", count: 3 },
      { id: "civil", name: "Ing. Civil", count: 1 },
    ]);
  });

  it("counts a key once even if it is in two channels", () => {
    const s = summarizeOnline({ "civil-2023": ["a"], "informatica-2023": ["a", "b"] }, careers);
    expect(s.total).toBe(2);
  });

  it("is empty with nobody online and keeps unknown plans", () => {
    expect(summarizeOnline({ "civil-2023": [] }, careers)).toEqual({ total: 0, byCareer: [] });
    expect(summarizeOnline({ "x-2030": ["a"] }, careers).byCareer).toEqual([{ id: "x-2030", name: "x-2030", count: 1 }]);
  });
});
