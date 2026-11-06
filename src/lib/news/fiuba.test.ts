import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFiubaHome } from "./fiuba";

const html = readFileSync("data/noticias/fiuba-home-2026-11-06.html", "utf8");

describe("parseFiubaHome", () => {
  const news = parseFiubaHome(html);

  it("lee las noticias destacadas de la portada, sin repetidas", () => {
    expect(news.length).toBeGreaterThan(15);
    expect(new Set(news.map((n) => n.id)).size).toBe(news.length);
    const credencial = news.find((n) => n.title === "La FIUBA lanza la Credencial Estudiantil");
    expect(credencial).toMatchObject({
      url: "https://www.fi.uba.ar/noticias/la-fiuba-lanza-la-credencial-estudiantil",
      publishedAt: "2026-11-02T12:30:00.000Z",
    });
    expect(credencial?.summary).toMatch(/^La Facultad de Ingeniería lanza la Credencial Estudiantil FIUBA/);
    expect(credencial?.imageUrl).toMatch(/^https:\/\/cms\.fi\.uba\.ar\/uploads\/(medium|small)_/);
  });

  it("no trae los avisos de compras de la lista completa", () => {
    expect(news.some((n) => /nueva fecha de apertura|compra de|adquisici[oó]n de/i.test(n.title))).toBe(false);
  });

  it("ordena de la más nueva a la más vieja y limpia los espacios", () => {
    const dates = news.map((n) => n.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(news.every((n) => !n.summary || n.summary === n.summary.trim())).toBe(true);
  });

  it("avisa si la página cambió", () => {
    expect(() => parseFiubaHome("<html></html>")).toThrow(/cambió el sitio/);
  });
});
