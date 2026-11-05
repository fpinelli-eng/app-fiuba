import { describe, expect, it } from "vitest";
import { decodeSiuPage, isLink, siuExamsUrl } from "./exams-fetch";

const SEARCH =
  "https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen?formulario_filtro%5Bra%5D=3b5e&formulario_filtro%5Bcarrera%5D=74fc&formulario_filtro%5Bplan%5D=f05d";

describe("SIU exam links", () => {
  it("tells a link from the copied text", () => {
    expect(isLink(SEARCH)).toBe(true);
    expect(isLink(`  ${SEARCH}\n`)).toBe(true);
    expect(isLink("guaraniautogestion.fi.uba.ar/g3w/fecha_examen?x=1")).toBe(true);
    expect(isLink("ECONOMÍA (TC010)\nMesa 1 Surace\t11/12/2026")).toBe(false);
  });

  it("accepts the search link, with brackets encoded or not", () => {
    expect(siuExamsUrl(SEARCH)).toEqual({ url: SEARCH });
    const raw = "https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen?formulario_filtro[carrera]=74fc&formulario_filtro[plan]=f05d";
    expect("url" in siuExamsUrl(raw)).toBe(true);
    expect("url" in siuExamsUrl("guaraniautogestion.fi.uba.ar/g3w/fecha_examen/?formulario_filtro[carrera]=74fc")).toBe(true);
  });

  it("only allows the SIU's Fechas de examen page", () => {
    for (const bad of [
      "https://evil.example/g3w/fecha_examen?formulario_filtro[carrera]=1",
      "https://guaraniautogestion.fi.uba.ar.evil.example/g3w/fecha_examen?formulario_filtro[carrera]=1",
      "https://guaraniautogestion.fi.uba.ar/g3w/acceso?formulario_filtro[carrera]=1",
      "https://user:pass@guaraniautogestion.fi.uba.ar/g3w/fecha_examen?formulario_filtro[carrera]=1",
      "https://guaraniautogestion.fi.uba.ar:8080/g3w/fecha_examen?formulario_filtro[carrera]=1",
      "notaurl",
    ]) {
      expect("error" in siuExamsUrl(bad), bad).toBe(true);
    }
  });

  it("asks for the search when the link has no filters", () => {
    const result = siuExamsUrl("https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen");
    expect(result).toEqual({ error: expect.stringContaining("Buscar") });
  });

  it("decodes the page as ISO-8859-1 unless it says UTF-8", () => {
    const latin1 = new Uint8Array([0x45, 0x43, 0x4f, 0x4e, 0x4f, 0x4d, 0xcd, 0x41]).buffer;
    expect(decodeSiuPage(latin1, "text/html; charset=ISO-8859-1")).toBe("ECONOMÍA");
    expect(decodeSiuPage(latin1, null)).toBe("ECONOMÍA");
    const utf8 = new TextEncoder().encode("ECONOMÍA").buffer as ArrayBuffer;
    expect(decodeSiuPage(utf8, "text/html; charset=UTF-8")).toBe("ECONOMÍA");
  });
});
