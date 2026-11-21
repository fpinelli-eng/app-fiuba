// Geometría del mapa de columnas (escritorio): el ancho de cada materia se adapta al lugar
// disponible, entre el tamaño de siempre y un máximo para que los nombres respiren.

/** Ancho mínimo de una materia (el de siempre): por debajo, el mapa se desplaza a lo ancho. */
export const MIN_NODE_W = 112;
/** Ancho máximo: más allá, las tarjetas quedan vacías y cuesta seguir una fila con la vista. */
export const MAX_NODE_W = 168;
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
