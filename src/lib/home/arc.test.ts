import { describe, expect, it } from "vitest";
import { arcPoint, arcSegments, arcStations, careerYear, categoryAt, ordinal } from "./arc";

describe("arcStations", () => {
  it("reparte los créditos por año después del CBC (Industrial 2023: 8 cuatrimestres)", () => {
    expect(arcStations(236, 38, 8)).toEqual([
      { label: "CBC", short: "CBC", credits: 38 },
      { label: "2.º año", short: "2.º", credits: 88 },
      { label: "3.er año", short: "3.er", credits: 137 },
      { label: "4.º año", short: "4.º", credits: 187 },
      { label: "Título", short: "Título", credits: 236 },
    ]);
  });
  it("un cuatrimestre impar suma un año", () => {
    const stations = arcStations(250, 40, 9);
    expect(stations.map((s) => s.label)).toEqual(["CBC", "2.º año", "3.er año", "4.º año", "5.º año", "Título"]);
    expect(stations.at(-1)!.credits).toBe(250);
  });
  it("sin CBC no hay parada de CBC", () => {
    expect(arcStations(100, 0, 2).map((s) => s.label)).toEqual(["Título"]);
  });
});

describe("ordinal", () => {
  it("usa primer y tercer", () => {
    expect([1, 2, 3, 4].map(ordinal)).toEqual(["1.er", "2.º", "3.er", "4.º"]);
  });
});

describe("careerYear", () => {
  const stations = arcStations(236, 38, 8);
  it("el CBC es el primer año", () => {
    expect(careerYear(0, stations)).toEqual({ label: "1.er año", next: 0 });
    expect(careerYear(37, stations)).toEqual({ label: "1.er año", next: 0 });
  });
  it("cada parada alcanzada suma un año", () => {
    expect(careerYear(38, stations)).toEqual({ label: "2.º año", next: 1 });
    expect(careerYear(138, stations)).toEqual({ label: "4.º año", next: 3 });
    expect(careerYear(200, stations)).toEqual({ label: "5.º año", next: 4 });
  });
  it("con todos los créditos, la carrera está completa", () => {
    expect(careerYear(236, stations)).toEqual({ label: "Carrera completa", next: null });
  });
});

describe("arcSegments", () => {
  it("apila las categorías sin huecos, aunque falten obligatorias", () => {
    const s = arcSegments({ cbc: 38, required: 0, elective: 12, final: 0 }, 236);
    expect(s.map((x) => x.category)).toEqual(["cbc", "elective"]);
    expect(s[0].from).toBe(0);
    expect(s[1].from).toBeCloseTo(38 / 236);
    expect(s[1].to).toBeCloseTo(50 / 236);
  });
  it("solo los extremos son redondeados", () => {
    const s = arcSegments({ cbc: 38, required: 88, elective: 12, final: 0 }, 236);
    expect(s.map((x) => x.round)).toEqual([true, false, true]);
  });
  it("no pasa del final con electivas de más", () => {
    const s = arcSegments({ cbc: 38, required: 162, elective: 40, final: 12 }, 236);
    expect(s.at(-1)!.to).toBe(1);
    expect(s.map((x) => x.category)).toEqual(["cbc", "required", "elective"]);
  });
  it("sin créditos no hay segmentos", () => {
    expect(arcSegments({ cbc: 0, required: 0, elective: 0, final: 0 }, 236)).toEqual([]);
  });
  it("categoryAt da el color de la parada", () => {
    const s = arcSegments({ cbc: 38, required: 88, elective: 12, final: 0 }, 236);
    expect(categoryAt(s, 38 / 236)).toBe("cbc");
    expect(categoryAt(s, 88 / 236)).toBe("required");
    expect(categoryAt(s, 187 / 236)).toBeNull();
  });
});

describe("arcPoint", () => {
  it("va de izquierda a derecha por arriba", () => {
    expect(arcPoint(0).map(Math.round)).toEqual([60, 300]);
    expect(arcPoint(0.5).map(Math.round)).toEqual([320, 40]);
    expect(arcPoint(1).map(Math.round)).toEqual([580, 300]);
  });
});
