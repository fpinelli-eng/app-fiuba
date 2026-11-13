import { describe, expect, it } from "vitest";
import { parseRef } from "./referral";

describe("parseRef", () => {
  it("acepta el QR", () => {
    expect(parseRef("qr")).toBe("qr");
  });
  it("ignora lo que no está en la lista", () => {
    expect(parseRef(null)).toBeNull();
    expect(parseRef(undefined)).toBeNull();
    expect(parseRef("")).toBeNull();
    expect(parseRef("QR")).toBeNull();
    expect(parseRef(" qr")).toBeNull();
    expect(parseRef("qr2")).toBeNull();
    expect(parseRef("<script>")).toBeNull();
    expect(parseRef("toString")).toBeNull();
  });
});
