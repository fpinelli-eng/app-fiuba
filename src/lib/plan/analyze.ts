// Checks a semester plan the way the 07-plan prototype does: overlapping classes,
// rushed trips between campuses, and totals. Asynchronous classes are listed apart.

import type { Campus } from "../siu/parser";
import { WEEK_DAYS, type ClassBlock, type CourseOption, type WeekDay } from "./options";

/** Less time than this between classes at different campuses is a rushed trip. */
export const MIN_TRANSFER_MINUTES = 60;

export interface PlannedCourse {
  option: CourseOption;
  /** From the study plan (the SIU offer has no credits). */
  credits?: number;
}

export interface Overlap {
  day: WeekDay;
  start: number;
  end: number;
  courseIds: [string, string];
}

export interface RushedTransfer {
  day: WeekDay;
  from: Campus;
  to: Campus;
  /** End of the first class and start of the next, in minutes since midnight. */
  leaveAt: number;
  arriveAt: number;
  courseIds: [string, string];
}

export interface PlanAnalysis {
  subjects: number;
  credits: number;
  /** In-person and synchronous classes. */
  weeklyMinutes: number;
  asyncMinutes: number;
  overlaps: Overlap[];
  rushedTransfers: RushedTransfer[];
  asyncClasses: { courseId: string; block: ClassBlock }[];
}

type PlacedBlock = ClassBlock & { courseId: string };

export function analyzePlan(courses: PlannedCourse[]): PlanAnalysis {
  const placed: PlacedBlock[] = [];
  const asyncClasses: PlanAnalysis["asyncClasses"] = [];
  let weeklyMinutes = 0;
  let asyncMinutes = 0;

  for (const { option } of courses) {
    for (const block of option.blocks) {
      if (block.async) {
        asyncMinutes += block.end - block.start;
        asyncClasses.push({ courseId: option.id, block });
      } else {
        weeklyMinutes += block.end - block.start;
        placed.push({ ...block, courseId: option.id });
      }
    }
  }

  const overlaps: Overlap[] = [];
  const rushedTransfers: RushedTransfer[] = [];
  const days: WeekDay[] = [...WEEK_DAYS, "Domingo"];

  for (const day of days) {
    const list = placed.filter((b) => b.day === day).sort((a, b) => a.start - b.start || a.end - b.end);

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.courseId === b.courseId) continue;
        if (a.start < b.end && b.start < a.end) {
          overlaps.push({
            day,
            start: Math.max(a.start, b.start),
            end: Math.min(a.end, b.end),
            courseIds: [a.courseId, b.courseId],
          });
        }
      }
    }

    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i];
      const b = list[i + 1];
      const gap = b.start - a.end;
      if (gap >= 0 && gap < MIN_TRANSFER_MINUTES && a.campus && b.campus && a.campus !== b.campus) {
        rushedTransfers.push({
          day,
          from: a.campus,
          to: b.campus,
          leaveAt: a.end,
          arriveAt: b.start,
          courseIds: [a.courseId, b.courseId],
        });
      }
    }
  }

  return {
    subjects: new Set(courses.map((c) => c.option.subjectCode)).size,
    credits: courses.reduce((sum, c) => sum + (c.credits ?? 0), 0),
    weeklyMinutes,
    asyncMinutes,
    overlaps,
    rushedTransfers,
    asyncClasses,
  };
}
