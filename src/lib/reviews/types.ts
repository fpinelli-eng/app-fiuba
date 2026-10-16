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

export interface CourseComment {
  id: number;
  stars: number;
  comment: string;
  pinned: boolean;
  termLabel: string;
}

export interface CourseDetail {
  courseId: number;
  label: string;
  teachers: string;
  subject: { name: string; credits: number } | null;
  score: Score | null;
  /** Count of reviews with 5, 4, 3, 2 and 1 stars. */
  distribution: [number, number, number, number, number];
  comments: CourseComment[];
  otherCourses: CourseSummary[];
}

/** "4,2" */
export const formatScore = (n: number) => n.toFixed(1).replace(".", ",");
