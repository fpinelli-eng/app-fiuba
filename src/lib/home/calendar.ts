import type { HomeBlock, HomeCourse } from "./courses";

// Layout of the home weekly calendar: pure, so it can be tested.

export const CALENDAR_DAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"] as const;

export interface PlacedBlock {
  course: HomeCourse;
  block: HomeBlock;
  /** 0-based color, one per subject in the order of the list (same order as the legend). */
  color: number;
  /** Side-by-side slot when classes overlap, and how many slots that day has. */
  lane: number;
  lanes: number;
}

export interface WeekLayout {
  /** Monday (index 0) to Saturday (index 5). */
  days: PlacedBlock[][];
  asyncClasses: { course: HomeCourse; color: number }[];
  /** Whole hours shown: from `first` to `last` (exclusive). */
  first: number;
  last: number;
  credits: number;
  /** Campuses with classes this week, for the legend. */
  campuses: ("PC" | "LH" | "CU")[];
}

/**
 * Hours shown: only the span with classes (at least MIN_SPAN hours), so the grid gives the
 * classes as much height as possible. Nobody needs to see an empty morning.
 */
const MIN_SPAN = 6;
const EMPTY = { first: 8, last: 22 };

/** Classes of one course that follow each other on the same day (theory 18–19 + practice 19–21) make one block. */
function joinBackToBack(blocks: HomeBlock[]): HomeBlock[] {
  const sorted = [...blocks].sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  const out: HomeBlock[] = [];
  for (const b of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.weekday === b.weekday && prev.end === b.start && prev.campus === b.campus) prev.end = b.end;
    else out.push({ ...b });
  }
  return out;
}

export function layoutWeek(courses: HomeCourse[]): WeekLayout {
  const subjects = [...new Set(courses.map((c) => c.subject))];
  const colorOf = (c: HomeCourse) => subjects.indexOf(c.subject);

  const inPerson = courses.flatMap((course) =>
    joinBackToBack(course.blocks.filter((b) => !b.async && b.weekday >= 1 && b.weekday <= 6)).map((block) => ({ course, block })),
  );

  const days = CALENDAR_DAYS.map((_, i) => {
    const list = inPerson.filter((p) => p.block.weekday === i + 1).sort((a, b) => a.block.start - b.block.start || a.block.end - b.block.end);
    // Overlapping classes share the column: each one takes the first free lane.
    const lanesEnd: number[] = [];
    const placed = list.map((p) => {
      let lane = lanesEnd.findIndex((end) => end <= p.block.start);
      if (lane < 0) {
        lane = lanesEnd.length;
        lanesEnd.push(p.block.end);
      } else lanesEnd[lane] = p.block.end;
      return { ...p, color: colorOf(p.course), lane, lanes: 0 };
    });
    for (const p of placed) p.lanes = Math.max(1, lanesEnd.length);
    return placed;
  });

  const starts = inPerson.map((p) => p.block.start);
  const ends = inPerson.map((p) => p.block.end);
  let first = starts.length ? Math.floor(Math.min(...starts) / 60) : EMPTY.first;
  let last = ends.length ? Math.ceil(Math.max(...ends) / 60) : EMPTY.last;
  if (last - first < MIN_SPAN) {
    // Grow downwards first (evening classes are the usual case), then upwards.
    last = Math.min(24, first + MIN_SPAN);
    first = Math.max(0, last - MIN_SPAN);
  }

  const creditsBySubject = new Map(courses.map((c) => [c.subject, c.credits]));
  const order: ("PC" | "LH" | "CU")[] = ["PC", "LH", "CU"];
  const used = new Set(inPerson.map((p) => p.block.campus).filter((c): c is "PC" | "LH" | "CU" => c !== null));

  return {
    days,
    asyncClasses: courses.filter((c) => c.blocks.some((b) => b.async)).map((course) => ({ course, color: colorOf(course) })),
    first,
    last,
    credits: [...creditsBySubject.values()].reduce((a, b) => a + b, 0),
    campuses: order.filter((c) => used.has(c)),
  };
}
