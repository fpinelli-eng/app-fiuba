import { describe, expect, it } from "vitest";
import { buildEmail, formatMoment } from "./email";

describe("formatMoment", () => {
  it("día, fecha y hora", () => {
    expect(formatMoment("2026-12-07T14:00:00")).toBe("el lunes 7/12 a las 14:00");
    expect(formatMoment("2026-11-14")).toBe("el sábado 14/11");
    expect(formatMoment("2026-12-07T23:59:00")).toBe("el lunes 7/12");
  });
});

describe("buildEmail", () => {
  it("final: materia, cierre y enlace a Finales", () => {
    const e = buildEmail({ id: 1, kind: "exam", email: "ana@fi.uba.ar", firstName: "Ana", subject: "Investigación Operativa", enrollTo: "2026-12-07T14:00:00" });
    expect(e.to).toBe("ana@fi.uba.ar");
    expect(e.subject).toBe("Abrió la inscripción al final de Investigación Operativa");
    expect(e.text).toContain("Hola, Ana:");
    expect(e.text).toContain("La inscripción cierra el lunes 7/12 a las 14:00.");
    expect(e.text).toContain("https://app-fiuba.vercel.app/finales");
  });
  it("fecha del calendario, y escapa el HTML", () => {
    const e = buildEmail({ id: 2, kind: "calendar", email: "beto@fi.uba.ar", firstName: null, title: "Inscripción <cursos> de verano", endsOn: "2026-11-14" });
    expect(e.subject).toBe("Empieza: Inscripción <cursos> de verano");
    expect(e.text.startsWith("Hola:")).toBe(true);
    expect(e.html).toContain("Inscripción &lt;cursos&gt; de verano");
    expect(e.html).not.toContain("<cursos>");
  });
});
