// Geometría del mapa de columnas (escritorio): el ancho y el alto de cada materia se adaptan al
// lugar disponible, para que el mapa entero entre en la pantalla.

/** Ancho mínimo de una materia (el de siempre): por debajo, el mapa se desplaza a lo ancho. */
export const MIN_NODE_W = 112;
/** Ancho máximo (pantallas de 1920 con las electivas plegadas): más allá las tarjetas quedan vacías. */
export const MAX_NODE_W = 196;
/** Separación entre columnas. */
export const COL_GAP = 10;
/** Ancho del CBC compactado en un solo módulo. */
export const CBC_CLOSED_W = 64;

export interface MapGeometry {
  /** Ancho de cada materia. */
  nodeW: number;
  /** Paso entre columnas (materia + separación). */
  col: number;
  /** Lo que se corren las columnas a la izquierda cuando el CBC está compactado. */
  off: number;
  /** Ancho total del mapa. */
  width: number;
}

/**
 * Ancho de materia que llena `available` píxeles con el CBC (abierto o compactado) y `terms`
 * cuatrimestres, acotado entre MIN_NODE_W y MAX_NODE_W. Sin medida (primer render, servidor),
 * el mínimo: así coincide la hidratación y después solo se agranda.
 */
export function nodeWidthFor(available: number | null, terms: number, cbcOpen: boolean): number {
  if (available === null || !Number.isFinite(available) || available <= 0) return MIN_NODE_W;
  const n = Math.max(0, Math.floor(terms));
  // Abierto:    available = nodeW + n * (nodeW + gap)
  // Compactado: available = CBC_CLOSED_W + n * (nodeW + gap)
  const raw = cbcOpen ? (available - n * COL_GAP) / (n + 1) : n > 0 ? (available - CBC_CLOSED_W - n * COL_GAP) / n : MIN_NODE_W;
  return Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, Math.floor(raw)));
}

/** Geometría completa del mapa para un ancho disponible. */
export function mapGeometry(available: number | null, terms: number, cbcOpen: boolean): MapGeometry {
  const nodeW = nodeWidthFor(available, terms, cbcOpen);
  const col = nodeW + COL_GAP;
  const off = cbcOpen ? 0 : nodeW - CBC_CLOSED_W;
  const n = Math.max(0, Math.floor(terms));
  const width = (n + 1) * col - COL_GAP - off;
  return { nodeW, col, off, width };
}

// Alto ---------------------------------------------------------------------------------
// El mapa entero (con el panel de electivas abierto o plegado) entra en la pantalla sin bajar:
// el alto de las materias se achica hasta un mínimo legible y, si ni así entra, se escala todo
// el mapa, pero nunca por debajo de MIN_SCALE (ahí se deja bajar la página).

/** Alto de una materia (el de siempre, y el máximo). */
export const MAX_NODE_H = 92;
/** Alto mínimo legible: nombre en dos líneas y la línea de estado y créditos. */
export const MIN_NODE_H = 58;
/** Por debajo de este alto el nombre se corta en dos líneas en vez de tres. */
export const COMPACT_NODE_H = 76;
/** Lugar de los títulos de columna ("1.º cuatr.") arriba de las materias. */
export const MAP_TOP = 34;
/** Escala mínima del mapa entero: más chico ya cuesta leer. */
export const MIN_SCALE = 0.75;

export interface MapRows {
  /** Alto de cada materia. */
  nodeH: number;
  /** Paso entre filas (materia + separación). */
  row: number;
  /** Alto del mapa sin escalar. */
  height: number;
  /** Escala del mapa entero (1 salvo que ni el alto mínimo entre). */
  scale: number;
  /** Materia compacta: el nombre en dos líneas. */
  compact: boolean;
}

/** Separación entre filas para un alto de materia: la de siempre (8 px) proporcional, mínimo 5. */
export function rowGapFor(nodeH: number): number {
  return Math.max(5, Math.round((nodeH * (100 - MAX_NODE_H)) / MAX_NODE_H));
}

/** Alto del mapa con `rows` filas de paso `row` (como antes: TOP + filas × paso − 2). */
export function mapHeightFor(rows: number, row: number): number {
  return MAP_TOP + Math.max(1, rows) * row - 2;
}

/**
 * Alto de las materias para que `rows` filas entren en `available` píxeles, entre MIN_NODE_H y
 * MAX_NODE_H. Si ni el mínimo entra, `scale` achica el mapa entero hasta MIN_SCALE. Sin medida
 * (primer render, servidor) el tamaño de siempre.
 */
export function rowGeometry(available: number | null, rows: number): MapRows {
  const r = Math.max(1, Math.floor(rows));
  const make = (nodeH: number, scale = 1): MapRows => {
    const row = nodeH + rowGapFor(nodeH);
    return { nodeH, row, height: mapHeightFor(r, row), scale, compact: nodeH < COMPACT_NODE_H };
  };
  if (available === null || !Number.isFinite(available) || available <= 0) return make(MAX_NODE_H);
  const maxRow = (available - MAP_TOP + 2) / r;
  let nodeH = MAX_NODE_H;
  while (nodeH > MIN_NODE_H && nodeH + rowGapFor(nodeH) > maxRow) nodeH--;
  if (nodeH >= MIN_NODE_H && nodeH + rowGapFor(nodeH) <= maxRow) return make(nodeH);
  const min = make(MIN_NODE_H);
  const scale = Math.max(MIN_SCALE, Math.min(1, available / min.height));
  return { ...min, scale: Math.floor(scale * 1000) / 1000 };
}
