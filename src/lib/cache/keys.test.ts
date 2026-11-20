import { describe, expect, it } from "vitest";
import { catalogTag, examsTag, offerTag, offerTermTag, SPEC, TAG } from "./keys";

const A = "industrial-2023";
const B = "informatica-2023";
const TERM = "2026-2C";

const sameKey = (x: string[], y: string[]) => JSON.stringify(x) === JSON.stringify(y);

describe("shared cache keys", () => {
  it("gives each plan its own catalog entry and tag", () => {
    expect(sameKey(SPEC.planCatalog(A).key, SPEC.planCatalog(B).key)).toBe(false);
    expect(SPEC.planCatalog(A).key).toContain(A);
    expect(SPEC.planCatalog(A).tags).toContain(catalogTag(A));
    expect(SPEC.planCatalog(A).tags).not.toContain(catalogTag(B));
    expect(sameKey(SPEC.reviewSubjects(A).key, SPEC.reviewSubjects(B).key)).toBe(false);
  });

  it("keys the offer and its scores by term and plan", () => {
    expect(sameKey(SPEC.termOffer(TERM, A).key, SPEC.termOffer(TERM, B).key)).toBe(false);
    expect(sameKey(SPEC.termOffer(TERM, A).key, SPEC.termOffer("2027-1C", A).key)).toBe(false);
    expect(sameKey(SPEC.offerScores(TERM, A).key, SPEC.offerScores(TERM, B).key)).toBe(false);
    expect(SPEC.termOffer(TERM, A).tags).toEqual(expect.arrayContaining([offerTag(TERM, A), offerTermTag(TERM)]));
    expect(SPEC.termOffer(TERM, A).tags).not.toContain(offerTag(TERM, B));
    // A new review revalidates the scores of every plan.
    expect(SPEC.offerScores(TERM, B).tags).toContain(TAG.scores);
  });

  it("keys exam tables by plan and day", () => {
    expect(sameKey(SPEC.examTables(A, "2026-11-19").key, SPEC.examTables(B, "2026-11-19").key)).toBe(false);
    expect(sameKey(SPEC.examTables(A, "2026-11-19").key, SPEC.examTables(A, "2026-11-20").key)).toBe(false);
    expect(SPEC.examTables(A, "2026-11-19").tags).toContain(examsTag(A));
    expect(SPEC.examTables(A, "2026-11-19").tags).not.toContain(examsTag(B));
  });

  it("never builds a key without its plan or term", () => {
    expect(() => SPEC.planCatalog("")).toThrow();
    expect(() => SPEC.termOffer("", A)).toThrow();
    expect(() => SPEC.termOffer(TERM, "")).toThrow();
    expect(() => SPEC.examTables("", "2026-11-19")).toThrow();
  });

  it("does not mix entries of different kinds", () => {
    const keys = [
      SPEC.planCatalog(A),
      SPEC.reviewSubjects(A),
      SPEC.careers(),
      SPEC.currentTerm(),
      SPEC.termOffer(TERM, A),
      SPEC.offerScores(TERM, A),
      SPEC.examTables(A, "2026-11-19"),
      SPEC.newsPage("2026-11-19"),
    ].map((s) => JSON.stringify(s.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps tags within Next's 256 characters", () => {
    expect(offerTag(TERM, "x".repeat(200)).length).toBeLessThanOrEqual(256);
  });
});
