import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { previewImport } from "../admin/offer-import";
import { offerPreviewProblem, offerTextProblem } from "./check";
import { MAX_OFFER_CHARS, submissionRefusal, submissionStatusText, submissionSummary } from "./submission";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf-8");
const industrialPlan = (JSON.parse(read("data/planes/industrial-2020.json")) as { materia: string }[]).map((m, i) => ({
  id: i + 1,
  name: m.materia,
}));
const industrialText = read("data/siu/industrial-2023_2C2026.txt");
const term2C = { year: 2026, half: 2 as const };

describe("offerTextProblem", () => {
  it("asks for a text when it is empty", () => {
    expect(offerTextProblem("  \n ")).toMatch(/Pegá/);
  });
  it("refuses texts over the limit of the database", () => {
    expect(offerTextProblem("a".repeat(MAX_OFFER_CHARS + 1))).toMatch(/demasiado largo/);
    expect(offerTextProblem("a".repeat(MAX_OFFER_CHARS))).toBeNull();
  });
  it("accepts a real SIU page", () => {
    expect(offerTextProblem(industrialText)).toBeNull();
  });
});

describe("offerPreviewProblem", () => {
  it("accepts the offer of the plan for the current term", () => {
    const { preview } = previewImport(industrialText, industrialPlan, new Map());
    expect(offerPreviewProblem(preview, term2C)).toBeNull();
  });
  it("says when the text is not the SIU offer", () => {
    const { preview } = previewImport("Hola, esto no es el SIU", industrialPlan, new Map());
    expect(offerPreviewProblem(preview, term2C)).toMatch(/No reconocemos el texto/);
  });
  it("says when the text is of another term", () => {
    const { preview } = previewImport(industrialText, industrialPlan, new Map());
    expect(offerPreviewProblem(preview, { year: 2026, half: 1 })).toBe("El texto es del 2C 2026 y el cuatrimestre actual es el 1C 2026.");
  });
  it("says when no subject is of the plan", () => {
    const { preview } = previewImport(industrialText, [{ id: 1, name: "Materia que no existe" }], new Map());
    expect(offerPreviewProblem(preview, term2C)).toMatch(/Ninguna materia/);
  });
  it("also reads the public table", () => {
    const quimica = (JSON.parse(read("data/planes/quimica-2020.json")) as { materia: string }[]).map((m, i) => ({ id: i + 1, name: m.materia }));
    const { preview } = previewImport(read("data/siu/quimica_2C2026_tabla-publica.txt"), quimica, new Map());
    expect(offerPreviewProblem(preview, term2C)).toBeNull();
  });
});

describe("what the student sees", () => {
  it("summarizes what was found", () => {
    expect(submissionSummary({ subjects: 34, courses: 120 })).toBe("Encontramos 34 materias y 120 cursos de tu plan.");
    expect(submissionSummary({ subjects: 1, courses: 1 })).toBe("Encontramos 1 materia y 1 curso de tu plan.");
  });
  it("explains why the database refused it", () => {
    expect(submissionRefusal("pending_limit")).toMatch(/esperando revisión/);
    expect(submissionRefusal("already_published")).toMatch(/ya está cargada/);
    expect(submissionRefusal(undefined)).toMatch(/No pudimos guardar/);
  });
  it("shows the status of the latest submission", () => {
    const sent = { createdAt: "2026-11-11T15:00:00Z", subjects: 34, courses: 120 };
    expect(submissionStatusText(null)).toBeNull();
    expect(submissionStatusText({ ...sent, status: "pending" })).toMatch(/^Recibimos la oferta que mandaste el 11\/11 \(34 materias y 120 cursos\)/);
    expect(submissionStatusText({ ...sent, status: "rejected" })).toMatch(/^No pudimos usar la oferta/);
    expect(submissionStatusText({ ...sent, status: "published" })).toBeNull();
  });
});
