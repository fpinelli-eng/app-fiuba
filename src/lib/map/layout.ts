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

// Zoom libre ----------------------------------------------------------------------------
// La primera vista es la ajustada (todo en la pantalla). Después el estudiante puede acercar o
// alejar el mapa con los botones, Ctrl/⌘ + rueda o pellizcando el panel táctil. El zoom es
// relativo a la vista ajustada: 1 (100 %) = todo en la pantalla.

/** Zoom mínimo y máximo, relativos a la vista ajustada. */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2;
/** Paso de los botones "−" y "+". */
export const ZOOM_STEP = 0.1;

/** Acota el zoom entre ZOOM_MIN y ZOOM_MAX, redondeado a centésimos (sin medida válida, 1). */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 100) / 100;
}

/** Zoom después de "+" (dir 1) o "−" (dir -1): el siguiente múltiplo de ZOOM_STEP. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const z = clampZoom(zoom);
  const steps = z / ZOOM_STEP;
  // Ya en un múltiplo (con tolerancia por los decimales): un paso entero; si no, al múltiplo más cercano en esa dirección.
  const near = Math.round(steps);
  const base = Math.abs(steps - near) < 1e-6 ? near + dir : dir > 0 ? Math.ceil(steps) : Math.floor(steps);
  return clampZoom(base * ZOOM_STEP);
}

/**
 * Zoom después de un evento de rueda con Ctrl/⌘ (o un pellizco del panel táctil, que el navegador
 * manda como rueda con Ctrl). Proporcional al desplazamiento, con un tope por evento para que una
 * rueda de mouse (±100 px por muesca) avance de a un paso cómodo.
 */
export function wheelZoom(zoom: number, deltaY: number, deltaMode = 0): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clampZoom(zoom);
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const factor = Math.min(1.15, Math.max(1 / 1.15, Math.exp(-px * 0.01)));
  return clampZoom(zoom * factor);
}

/**
 * Desplazamiento (en un eje) que deja quieto, después de cambiar la escala, el punto del mapa que
 * estaba bajo `point` (posición del cursor dentro del contenedor visible). `pad` es el relleno del
 * contenedor antes del mapa escalado; `from` y `to`, la escala efectiva antes y después.
 */
export function zoomScrollFor(scroll: number, point: number, pad: number, from: number, to: number): number {
  if (!(from > 0) || !(to > 0)) return Math.max(0, scroll);
  const content = (scroll + point - pad) / from;
  return Math.max(0, Math.round(content * to + pad - point));
}

/** Lo que importa del viewport para decidir si reajustar el mapa. */
export interface ViewportSample {
  /** window.devicePixelRatio: cambia con el zoom del navegador (Ctrl + / Ctrl −). */
  dpr: number;
  /** window.innerWidth e innerHeight (px CSS). */
  width: number;
  height: number;
}

/**
 * ¿Se vuelve a ajustar el mapa a la pantalla? `fit` es el viewport del último ajuste (null: nunca).
 * - Cambió devicePixelRatio: es el zoom del navegador. No se pelea: el mapa queda del tamaño que
 *   tenía y la página crece y se desplaza.
 * - Cambió el tamaño de la ventana (mismo DPR): se reajusta, salvo que el estudiante haya elegido
 *   un zoom a mano.
 * - Mismo viewport: cambió algo dentro de la página (se plegaron las electivas, el encabezado pasó
 *   a dos líneas): se reajusta siempre.
 */
export function shouldRefit(fit: ViewportSample | null, now: ViewportSample, manualZoom: boolean): boolean {
  if (fit === null) return true;
  if (Math.abs(now.dpr - fit.dpr) > 0.001) return false;
  if (now.width !== fit.width || now.height !== fit.height) return !manualZoom;
  return true;
}
