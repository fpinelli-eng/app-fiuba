// Types and formatting of the review screens. No database access: client components import from here.

export interface Score {
  average: number;
  count: number;
}

export interface CourseSummary {
  courseId: number;
  /** "Curso 2" */
  label: string;
  /** "Ortega, Lucero, Paredes +1" */
  teachers: string;
  /** "Mié y Jue 19–23 hs · Las Heras" */
  schedule: string;
  score: Score | null;
}

export interface SubjectReviews {
  subjectId: number;
  name: string;
  credits: number;
  /** "Obligatoria" | "Electiva" | "Trabajo final" */
  kindLabel: string;
  /** Courses of the current term, empty when it is not offered. */
  courses: CourseSummary[];
}

export interface ReviewCatalog {
  term: { id: string; label: string } | null;
  subjects: SubjectReviews[];
}

/** A comment of the course page: an app review or a historical Dolly opinion (merge.ts). */
export interface CourseComment {
  /** "app-12" | "dolly-345": ids repeat between the two tables. */
  key: string;
  source: "app" | "dolly";
  stars: number;
  comment: string;
  pinned: boolean;
  /** "2C 2026" */
  termLabel: string;
  /** Dolly only: the teacher surveyed, as written in Dolly. */
  teacher: string | null;
}

export interface CourseDetail {
  courseId: number;
  label: string;
  teachers: string;
  subject: { name: string; credits: number } | null;
  /** App reviews and Dolly opinions together. */
  score: Score | null;
  /** Count of reviews with 5, 4, 3, 2 and 1 stars, both sources. */
  distribution: [number, number, number, number, number];
  /** Every app comment and the newest Dolly ones (see getCourse). */
  comments: CourseComment[];
  /** Reviews with a comment, both sources, also the ones not in `comments`. */
  commentCount: number;
  /** Dolly opinions counted in the score: when there are any, the page credits Dolly. */
  dollyCount: number;
  otherCourses: CourseSummary[];
}

/** "4,2" */
export const formatScore = (n: number) => n.toFixed(1).replace(".", ",");
