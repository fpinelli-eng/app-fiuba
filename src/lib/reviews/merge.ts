import type { CourseComment, Score } from "./types";

// Pure logic that mixes the app's reviews (public.reviews) with the historical Dolly opinions
// (public.historical_reviews) at read time: one score per course and one comments list.
// The two tables stay apart (Dolly terms are not in public.terms); pending reviews only look at
// the app's own reviews (pending.ts).

export type ReviewSource = "app" | "dolly";

/** How many reviews of a source gave a course that many stars (from course_star_counts()). */
export interface StarCount {
  courseId: number;
  source: ReviewSource;
  stars: number;
  n: number;
}

export interface CourseStars {
  score: Score | null;
  /** Count of reviews with 5, 4, 3, 2 and 1 stars. */
  distribution: [number, number, number, number, number];
  /** How many of them come from Dolly (for the credit line). */
  dolly: number;
}

/** Score, distribution and Dolly count per course, both sources together. */
export function courseStars(rows: StarCount[]): Map<number, CourseStars> {
  const out = new Map<number, CourseStars>();
  for (const r of rows) {
    if (!(r.stars >= 1 && r.stars <= 5) || r.n <= 0) continue;
    const c = out.get(r.courseId) ?? { score: null, distribution: [0, 0, 0, 0, 0], dolly: 0 };
    const count = (c.score?.count ?? 0) + r.n;
    const sum = (c.score ? c.score.average * c.score.count : 0) + r.stars * r.n;
    c.score = { average: sum / count, count };
    c.distribution[5 - r.stars] += r.n;
    if (r.source === "dolly") c.dolly += r.n;
    out.set(r.courseId, c);
  }
  return out;
}

/** "2026-2C" (app term id) or "2C 2021" (Dolly) → 20262 / 20212, to sort by recency. 0 if unknown. */
export function termRank(term: string): number {
  const app = /^(\d{4})-([12])C$/.exec(term);
  if (app) return Number(app[1]) * 10 + Number(app[2]);
  const dolly = /^([12])C (\d{4})$/.exec(term);
  if (dolly) return Number(dolly[2]) * 10 + Number(dolly[1]);
  const year = /\b(\d{4})\b/.exec(term);
  return year ? Number(year[1]) * 10 : 0;
}

export interface AppCommentRow {
  id: number;
  stars: number;
  comment: string;
  pinned: boolean;
  /** "2026-2C" */
  termId: string;
  termLabel: string;
  createdAt: string;
}

export interface DollyCommentRow {
  id: number;
  stars: number;
  comment: string;
  teacher: string;
  /** "2C 2021" */
  termLabel: string;
}

/**
 * One list: pinned app reviews first, then the newest term first. In the same term, app reviews go
 * before Dolly opinions and the newest app review first.
 */
export function mixComments(app: AppCommentRow[], dolly: DollyCommentRow[]): CourseComment[] {
  const items = [
    ...app.map((r) => ({
      rank: termRank(r.termId),
      at: r.createdAt,
      comment: {
        key: `app-${r.id}`,
        source: "app" as const,
        stars: r.stars,
        comment: r.comment,
        pinned: r.pinned,
        termLabel: r.termLabel,
        teacher: null,
      },
    })),
    ...dolly.map((r) => ({
      rank: termRank(r.termLabel),
      at: "",
      comment: {
        key: `dolly-${r.id}`,
        source: "dolly" as const,
        stars: r.stars,
        comment: r.comment,
        pinned: false,
        termLabel: r.termLabel,
        teacher: r.teacher,
      },
    })),
  ];
  return items
    .sort(
      (a, b) =>
        Number(b.comment.pinned) - Number(a.comment.pinned) ||
        b.rank - a.rank ||
        Number(b.comment.source === "app") - Number(a.comment.source === "app") ||
        b.at.localeCompare(a.at),
    )
    .map((i) => i.comment);
}
