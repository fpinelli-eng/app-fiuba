"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MapData } from "./data";
import type { Progress, SubjectStatus } from "./model";

export type SubjectProgress = { status: SubjectStatus; grade: number | null };

/**
 * The student's progress in the browser, saved to the database on every change.
 * The screen updates at once; if saving fails, the change is undone and `saveError` says so.
 * Used by the map and the quick-load screen.
 */
export function useProgress(userId: string, initial: MapData["progress"]) {
  const [progress, setProgress] = useState<Progress>(() => ({
    subjects: new Map(initial.subjects.map((s) => [s.subjectId, { status: s.status, grade: s.grade }])),
    requirements: new Set(initial.requirements),
  }));
  const [saveError, setSaveError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const latest = useRef(progress);
  useEffect(() => {
    latest.current = progress;
  }, [progress]);

  const fail = () => setSaveError("No pudimos guardar el cambio. Probá de nuevo.");

  const setSubject = (id: number, value: SubjectProgress | null) =>
    setProgress((p) => {
      const subjects = new Map(p.subjects);
      if (value) subjects.set(id, value);
      else subjects.delete(id);
      return { ...p, subjects };
    });

  const setRequirement = (id: number, on: boolean) =>
    setProgress((p) => {
      const requirements = new Set(p.requirements);
      if (on) requirements.add(id);
      else requirements.delete(id);
      return { ...p, requirements };
    });

  async function saveSubject(id: number, next: SubjectProgress | null) {
    const before = latest.current.subjects.get(id) ?? null;
    setSaveError(null);
    setSubject(id, next);
    const { error } = next
      ? await supabase
          .from("user_subjects")
          .upsert({ user_id: userId, subject_id: id, status: next.status, grade: next.grade }, { onConflict: "user_id,subject_id" })
      : await supabase.from("user_subjects").delete().eq("user_id", userId).eq("subject_id", id);
    if (error) {
      setSubject(id, before);
      fail();
    }
  }

  async function saveRequirement(id: number, approved: boolean) {
    setSaveError(null);
    setRequirement(id, approved);
    const { error } = approved
      ? await supabase.from("user_requirements").upsert({ user_id: userId, requirement_id: id }, { onConflict: "user_id,requirement_id" })
      : await supabase.from("user_requirements").delete().eq("user_id", userId).eq("requirement_id", id);
    if (error) {
      setRequirement(id, !approved);
      fail();
    }
  }

  return { progress, saveSubject, saveRequirement, saveError };
}
