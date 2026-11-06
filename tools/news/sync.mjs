// Downloads the FIUBA home page and prints its featured news as JSON, for the workflow
// "Noticias de la FIUBA" to upsert into public.fiuba_news. Run with:
//   node --experimental-strip-types tools/news/sync.mjs > news.json
// Reads a local file instead with: node --experimental-strip-types tools/news/sync.mjs <file.html>
import { readFileSync } from "node:fs";
import { FIUBA_SITE, parseFiubaHome } from "../../src/lib/news/fiuba.ts";

const file = process.argv[2];
let html;
if (file) {
  html = readFileSync(file, "utf8");
} else {
  const res = await fetch(`${FIUBA_SITE}/`, {
    headers: { "user-agent": "FIUBI-noticias (+https://app-fiuba.vercel.app)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`fi.uba.ar respondió ${res.status}`);
  html = await res.text();
}

const news = parseFiubaHome(html);
if (news.length === 0) throw new Error("La portada de la FIUBA no trajo noticias: ¿cambió el sitio?");
process.stdout.write(JSON.stringify(news));
console.error(`${news.length} noticias`);
