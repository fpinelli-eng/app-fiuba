import { describe, expect, it } from "vitest";
import { CBC_CLOSED_W, COL_GAP, MAX_NODE_W, MIN_NODE_W, mapGeometry, nodeWidthFor } from "./layout";

describe("nodeWidthFor", () => {
  it("usa el mínimo sin medida (primer render y servidor)", () => {
    expect(nodeWidthFor(null, 10, true)).toBe(MIN_NODE_W);
    expect(nodeWidthFor(0, 10, false)).toBe(MIN_NODE_W);
    expect(nodeWidthFor(Number.NaN, 10, true)).toBe(MIN_NODE_W);
  });

  it("no baja del mínimo en pantallas angostas (el mapa se desplaza)", () => {
    expect(nodeWidthFor(600, 10, true)).toBe(MIN_NODE_W);
    expect(nodeWidthFor(600, 10, false)).toBe(MIN_NODE_W);
  });

  it("no pasa del máximo en pantallas muy anchas", () => {
    expect(nodeWidthFor(5000, 10, true)).toBe(MAX_NODE_W);
    expect(nodeWidthFor(5000, 10, false)).toBe(MAX_NODE_W);
  });

  it("llena el ancho disponible entre los límites", () => {
    // 10 cuatrimestres + CBC abierto: 11 materias y 10 separaciones.
    const open = nodeWidthFor(1600, 10, true);
    expect(open).toBe(Math.floor((1600 - 10 * COL_GAP) / 11));
    expect(11 * open + 10 * COL_GAP).toBeLessThanOrEqual(1600);
    // CBC compactado: el módulo angosto deja más lugar a los cuatrimestres.
    const closed = nodeWidthFor(1600, 10, false);
    expect(closed).toBe(Math.floor((1600 - CBC_CLOSED_W - 10 * COL_GAP) / 10));
    expect(closed).toBeGreaterThan(open);
  });

  it("con más lugar (electivas plegadas) las materias crecen", () => {
    expect(nodeWidthFor(1500, 10, true)).toBeGreaterThan(nodeWidthFor(1290, 10, true));
  });

  it("aguanta cero cuatrimestres", () => {
    expect(nodeWidthFor(1000, 0, true)).toBe(MAX_NODE_W);
    expect(nodeWidthFor(1000, 0, false)).toBe(MIN_NODE_W);
  });
});

describe("mapGeometry", () => {
  it("con el mínimo reproduce la geometría fija de antes", () => {
    expect(mapGeometry(null, 10, true)).toEqual({ nodeW: 112, col: 122, off: 0, width: 11 * 122 - 10 });
    expect(mapGeometry(null, 10, false)).toEqual({ nodeW: 112, col: 122, off: 48, width: 11 * 122 - 10 - 48 });
  });

  it("el ancho total entra en el disponible cuando no se llega a un límite", () => {
    for (const cbcOpen of [true, false]) {
      for (const available of [1400, 1500, 1600]) {
        const g = mapGeometry(available, 10, cbcOpen);
        expect(g.width).toBeLessThanOrEqual(available);
        expect(available - g.width).toBeLessThan(cbcOpen ? 11 : 10);
      }
    }
  });

  it("la primera columna arranca pegada al CBC compactado", () => {
    const g = mapGeometry(1500, 10, false);
    expect(g.col - g.off).toBe(CBC_CLOSED_W + COL_GAP);
  });
});
