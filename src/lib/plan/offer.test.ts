import { describe, expect, it } from "vitest";
import { ELIGIBILITY_LABEL, ELIGIBILITY_TAG, canAdd, canConfirm, eligibilityOf, isPlanFilter, listedSubjects, type Eligibility } from "./offer";

describe("eligibilityOf", () => {
  it("lets the student take what the map enables or they are taking", () => {
    expect(eligibilityOf("enabled", false)).toBe("ok");
    expect(eligibilityOf("in_progress", false)).toBe("ok");
  });
  it("marks what is missing prerequisites and what is already passed", () => {
    expect(eligibilityOf("blocked", false)).toBe("missing");
    expect(eligibilityOf("final_pending", false)).toBe("final_pending");
    expect(eligibilityOf("approved", false)).toBe("approved");
  });
  it("keeps a subject confirmed this term after the map moves on", () => {
    // Cursada aprobada a mitad de cuatrimestre: las clases siguen hasta que termina.
    expect(eligibilityOf("final_pending", true)).toBe("ok");
    expect(eligibilityOf("approved", true)).toBe("ok");
  });
});

describe("labels and rules", () => {
  it("only labels what the student cannot take", () => {
    expect(ELIGIBILITY_LABEL.ok).toBeNull();
    expect(ELIGIBILITY_TAG.ok).toBeNull();
    expect(ELIGIBILITY_LABEL.missing).toBe("Te faltan correlativas");
    expect(ELIGIBILITY_TAG.missing).toBe("Sin correlativas");
    expect(ELIGIBILITY_LABEL.approved).toBe("Ya aprobada");
  });
  it("adds subjects without prerequisites to compare, but not passed ones", () => {
    expect(canAdd("ok")).toBe(true);
    expect(canAdd("missing")).toBe(true);
    expect(canAdd("final_pending")).toBe(false);
    expect(canAdd("approved")).toBe(false);
  });
  it("only confirms what the map lets the student take", () => {
    expect((["ok", "missing", "final_pending", "approved"] as Eligibility[]).filter(canConfirm)).toEqual(["ok"]);
  });
  it("reads back only known filters", () => {
    expect(isPlanFilter("cursar")).toBe(true);
    expect(isPlanFilter("oferta")).toBe(true);
    expect(isPlanFilter("todo")).toBe(false);
    expect(isPlanFilter(null)).toBe(false);
  });
});

describe("listedSubjects", () => {
  const subjects = [
    { code: "1", name: "Análisis Matemático II", eligibility: "approved" as const },
    { code: "2", name: "Física II", eligibility: "ok" as const },
    { code: "3", name: "Física III", eligibility: "missing" as const },
    { code: "4", name: "Álgebra Lineal", eligibility: "ok" as const },
    { code: "5", name: "Probabilidad", eligibility: "final_pending" as const },
  ];
  const none = new Set<string>();
  const codes = (list: { code: string }[]) => list.map((s) => s.code);

  it("'Para cursar' shows what the student can take, in the order it comes", () => {
    expect(codes(listedSubjects(subjects, "cursar", "", none))).toEqual(["2", "4"]);
  });
  it("'Para cursar' keeps what is already in option A or B", () => {
    expect(codes(listedSubjects(subjects, "cursar", "", new Set(["3"])))).toEqual(["2", "3", "4"]);
  });
  it("'Toda la oferta' shows everything, takeable first and passed last", () => {
    expect(codes(listedSubjects(subjects, "oferta", "", none))).toEqual(["2", "4", "3", "5", "1"]);
  });
  it("searches within the current filter, without accents or case", () => {
    expect(codes(listedSubjects(subjects, "cursar", "fisica", none))).toEqual(["2"]);
    expect(codes(listedSubjects(subjects, "oferta", "FÍSICA", none))).toEqual(["2", "3"]);
    expect(codes(listedSubjects(subjects, "cursar", " algebra ", none))).toEqual(["4"]);
    expect(codes(listedSubjects(subjects, "cursar", "analisis", none))).toEqual([]);
  });
});
