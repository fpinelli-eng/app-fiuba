import { describe, expect, it } from "vitest";
import { commentProblem } from "./filter";

describe("comment filter", () => {
  it("lets normal criticism through", () => {
    expect(commentProblem("Exigente pero justo. El parcial fue larguísimo y la corrección, dura.")).toBeNull();
    expect(commentProblem("Muy mal organizado, no lo recomiendo.")).toBeNull();
    expect(commentProblem("Tuvimos 3 parciales y 2 TPs en 2026.")).toBeNull();
  });

  it("blocks insults, with or without accents and capitals", () => {
    expect(commentProblem("El profe es un BOLUDO")).toMatch(/ofensivas/);
    expect(commentProblem("Una estúpida pérdida de tiempo")).toMatch(/ofensivas/);
  });

  it("blocks phones, mails, links and handles", () => {
    expect(commentProblem("Escribime al 11 5555-1234")).toMatch(/teléfonos/);
    expect(commentProblem("clases particulares: juan@gmail.com")).toMatch(/teléfonos/);
    expect(commentProblem("mirá www.apuntes.com.ar")).toMatch(/teléfonos/);
    expect(commentProblem("seguime en @apuntesfiuba")).toMatch(/teléfonos/);
  });

  it("limits the length", () => {
    expect(commentProblem("a".repeat(501))).toMatch(/500/);
  });
});
