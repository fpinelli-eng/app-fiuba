import { describe, expect, it } from "vitest";
import {
  CBC_CLOSED_W,
  COL_GAP,
  MAP_TOP,
  MAX_NODE_H,
  MAX_NODE_W,
  MIN_NODE_H,
  MIN_NODE_W,
  MIN_SCALE,
  mapGeometry,
  mapHeightFor,
  nodeWidthFor,
  rowGapFor,
  rowGeometry,
  shouldRefit,
} from "./layout";

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

describe("rowGeometry", () => {
  it("sin medida usa el tamaño de siempre", () => {
    expect(rowGeometry(null, 6)).toEqual({ nodeH: 92, row: 100, height: MAP_TOP + 600 - 2, scale: 1, compact: false });
  });

  it("con lugar de sobra no pasa del máximo", () => {
    const g = rowGeometry(2000, 6);
    expect(g.nodeH).toBe(MAX_NODE_H);
    expect(g.row).toBe(100);
  });

  it("achica las materias para que todas las filas entren", () => {
    for (const available of [450, 500, 560, 620]) {
      const g = rowGeometry(available, 6);
      expect(g.scale).toBe(1);
      expect(g.height).toBeLessThanOrEqual(available);
      expect(g.nodeH).toBeGreaterThanOrEqual(MIN_NODE_H);
      expect(g.nodeH).toBeLessThanOrEqual(MAX_NODE_H);
      // Usa el lugar: una materia un píxel más alta ya no entraría.
      const next = g.nodeH + 1;
      if (next <= MAX_NODE_H) expect(mapHeightFor(6, next + rowGapFor(next))).toBeGreaterThan(available);
    }
  });

  it("marca compactas las materias bajas", () => {
    expect(rowGeometry(450, 6).compact).toBe(true);
    expect(rowGeometry(620, 6).compact).toBe(false);
  });

  it("si ni el mínimo entra, escala el mapa entero", () => {
    const min = mapHeightFor(8, MIN_NODE_H + rowGapFor(MIN_NODE_H));
    const g = rowGeometry(min * 0.9, 8);
    expect(g.nodeH).toBe(MIN_NODE_H);
    expect(g.scale).toBeGreaterThanOrEqual(0.89);
    expect(g.scale).toBeLessThan(1);
    expect(g.height * g.scale).toBeLessThanOrEqual(min * 0.9);
  });

  it("no escala por debajo del mínimo legible (ahí se baja la página)", () => {
    expect(rowGeometry(200, 10).scale).toBe(MIN_SCALE);
  });

  it("la separación entre filas es proporcional, con un mínimo", () => {
    expect(rowGapFor(92)).toBe(8);
    expect(rowGapFor(MIN_NODE_H)).toBe(5);
  });
});

describe("shouldRefit", () => {
  it("la primera medida siempre ajusta", () => {
    expect(shouldRefit(null, 1)).toBe(true);
    expect(shouldRefit(null, 1.25)).toBe(true);
  });
  it("el zoom del navegador (cambia el DPR) no reajusta", () => {
    expect(shouldRefit(1, 1.25)).toBe(false);
    expect(shouldRefit(1, 1.5)).toBe(false);
    expect(shouldRefit(1, 0.9)).toBe(false);
  });
  it("con el mismo DPR (ventana nueva, electivas plegadas) reajusta", () => {
    expect(shouldRefit(1, 1)).toBe(true);
    expect(shouldRefit(1.25, 1.25)).toBe(true);
    expect(shouldRefit(1, 1.0004)).toBe(true);
  });
});
