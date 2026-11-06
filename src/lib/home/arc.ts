// Progress arc of the home screen: pure, so it can be tested.
//
// The arc is a semicircle that fills with approved credits. Credits are stacked by category
// (CBC, required, electives, final work) instead of being placed where each subject sits in the
// suggested plan: the arc is always one continuous stroke, whatever order the student takes
// subjects in. The stations mark the credits at the end of each year of the suggested plan.

export type ArcCategory = "cbc" | "required" | "elective" | "final";

export interface ArcStation {
  /** "CBC", "2.º año", …, "Título". */
  label: string;
  /** Shorter label for the phone: "CBC", "2.º", …, "Título". */
  short: string;
  credits: number;
}

/**
 * Stations at the end of each year. The CBC is the 1st year; the plan's suggested terms (two per
 * year) set how many years come after it, and the credits are spread evenly over those years
 * (FIUBA plans load each term about the same). The last station is the degree.
 */
export function arcStations(total: number, cbcCredits: number, lastLevel: number): ArcStation[] {
  const years = Math.max(1, Math.ceil(lastLevel / 2));
  const stations: ArcStation[] = [];
  if (cbcCredits > 0) stations.push({ label: "CBC", short: "CBC", credits: cbcCredits });
  for (let k = 1; k < years; k++) {
    const n = k + 1;
    stations.push({
      label: `${ordinal(n)} año`,
      short: ordinal(n),
      credits: Math.round(cbcCredits + ((total - cbcCredits) * k) / years),
    });
  }
  stations.push({ label: "Título", short: "Título", credits: total });
  return stations;
}

/** 1 → "1.er", 3 → "3.er" (primer, tercer año), other numbers → "2.º". */
export function ordinal(n: number): string {
  return n === 1 || n === 3 ? `${n}.er` : `${n}.º`;
}

/**
 * Year of the degree from approved credits: one more than the stations already reached.
 * `next` is the station the student is heading to (null once the degree is complete).
 */
export function careerYear(credits: number, stations: ArcStation[]): { label: string; next: number | null } {
  const reached = stations.filter((s) => credits >= s.credits).length;
  if (reached >= stations.length) return { label: "Carrera completa", next: null };
  return { label: `${ordinal(reached + 1)} año`, next: reached };
}

// Geometry -------------------------------------------------------------------

export const ARC = { cx: 320, cy: 300, r: 260 } as const;

/** Point on the arc (t from 0, left end, to 1, right end) at radius r. */
export function arcPoint(t: number, r: number = ARC.r): [number, number] {
  const a = Math.PI * (1 - t);
  return [ARC.cx + r * Math.cos(a), ARC.cy - r * Math.sin(a)];
}

/** SVG path of the arc between t = a and t = b. */
export function arcPath(a: number, b: number): string {
  const [x1, y1] = arcPoint(a);
  const [x2, y2] = arcPoint(b);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${ARC.r} ${ARC.r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export interface ArcSegment {
  category: ArcCategory;
  /** Start and end, 0 to 1 along the arc. */
  from: number;
  to: number;
  d: string;
  /** The first and last visible segments get round ends; the joints between them, flat. */
  round: boolean;
}

/** Visible gap between two categories, along the arc. */
const GAP = 0.005;

/**
 * One segment per category with approved credits, stacked in a fixed order. If the categories
 * add up to more than the total (extra electives), the arc stops at the end.
 */
export function arcSegments(done: Record<ArcCategory, number>, total: number): ArcSegment[] {
  if (total <= 0) return [];
  const order: ArcCategory[] = ["cbc", "required", "elective", "final"];
  const ranges: { category: ArcCategory; from: number; to: number }[] = [];
  let start = 0;
  for (const category of order) {
    const credits = Math.max(0, done[category]);
    if (credits === 0 || start >= 1) continue;
    const end = Math.min(1, start + credits / total);
    ranges.push({ category, from: start, to: end });
    start = end;
  }
  return ranges.map((r, i) => {
    const first = i === 0;
    const last = i === ranges.length - 1;
    // The gap is trimmed from both sides of each joint, but never more than a third of a tiny segment.
    const trim = Math.min(GAP, (r.to - r.from) / 3);
    const from = first ? r.from : r.from + trim;
    const to = last ? r.to : r.to - trim;
    return { ...r, d: arcPath(from, to), round: first || last };
  });
}

/** Category whose segment covers t (stations take that color once reached). */
export function categoryAt(segments: ArcSegment[], t: number): ArcCategory | null {
  return segments.find((s) => t >= s.from - 1e-9 && t <= s.to + 1e-9)?.category ?? null;
}
