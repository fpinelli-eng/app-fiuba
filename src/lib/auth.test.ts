import { describe, expect, it } from "vitest";
import { profileFromUser, properName } from "./auth";

describe("properName", () => {
  it("pasa a mayúscula inicial los nombres en mayúsculas", () => {
    expect(properName("FRANCISCO")).toBe("Francisco");
    expect(properName("MARÍA JOSÉ GÓMEZ")).toBe("María José Gómez");
    expect(properName("  JUAN   PÉREZ ")).toBe("Juan Pérez");
  });
  it("deja en minúscula las partículas del medio", () => {
    expect(properName("ANA DE LA FUENTE")).toBe("Ana de la Fuente");
    expect(properName("DEL VALLE")).toBe("Del Valle");
  });
  it("respeta guiones y apóstrofos", () => {
    expect(properName("JEAN-PAUL O'NEILL")).toBe("Jean-Paul O'Neill");
  });
  it("arregla también los nombres en minúsculas", () => {
    expect(properName("lucía ñancul")).toBe("Lucía Ñancul");
  });
  it("respeta un nombre que ya trae mayúsculas y minúsculas", () => {
    expect(properName("Martina McDonald")).toBe("Martina McDonald");
  });
});

describe("profileFromUser", () => {
  it("formatea nombre, nombre de pila e iniciales", () => {
    const p = profileFromUser({
      email: "alumno@fi.uba.ar",
      user_metadata: { full_name: "FRANCISCO PEREZ", given_name: "FRANCISCO" },
    });
    expect(p.fullName).toBe("Francisco Perez");
    expect(p.firstName).toBe("Francisco");
    expect(p.initials).toBe("FP");
  });
});
