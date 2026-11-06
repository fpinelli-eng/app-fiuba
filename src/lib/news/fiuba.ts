// FIUBA news for Novedades, read from www.fi.uba.ar. Pure (no network, no database): the scheduled
// job (tools/news/sync.mjs, workflow "Noticias de la FIUBA") downloads the home page and passes the
// HTML here. Runs in Node with type stripping, so: only type annotations, no enums or path aliases.
//
// The site is a Next.js page whose data travels in <script id="__NEXT_DATA__">. Its home lists
// the news the FIUBA chose to feature ("noticias_ancladas"); the full /noticias list also has
// procurement notices ("Nueva fecha de apertura", "Compra de resmas…") that students do not need.

export const FIUBA_SITE = "https://www.fi.uba.ar";
const CMS = "https://cms.fi.uba.ar";

export interface FiubaNews {
  /** FIUBA's own id: stable, used to upsert. */
  id: number;
  title: string;
  /** The article's lead ("bajada"), plain text. */
  summary: string | null;
  url: string;
  imageUrl: string | null;
  /** ISO timestamp */
  publishedAt: string;
  /** Position in the home's featured list (0 = first). */
  rank: number;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function nextData(html: string): Raw {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("No encontré los datos de la página (__NEXT_DATA__): ¿cambió el sitio de la FIUBA?");
  return JSON.parse(m[1]) as Raw;
}

function imageOf(portada: unknown): string | null {
  if (!portada || typeof portada !== "object") return null;
  const p = portada as { url?: unknown; formats?: Record<string, { url?: unknown }> };
  const url = str(p.formats?.medium?.url) ?? str(p.formats?.small?.url) ?? str(p.url);
  if (!url) return null;
  return url.startsWith("/") ? CMS + url : url;
}

/** Collapses whitespace; the CMS leaves trailing spaces and line breaks in the lead. */
function clean(text: string | null): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t || null;
}

/** The featured news of the FIUBA home page, newest first, without repeats. */
export function parseFiubaHome(html: string): FiubaNews[] {
  const data = nextData(html);
  const home = (data.props as Raw | undefined)?.pageProps as Raw | undefined;
  const components = ((home?.home as Raw | undefined)?.componentes ?? []) as Raw[];
  const block = components.find((c) => c.__component === "home.noticias");
  if (!block) throw new Error("La portada de la FIUBA no tiene el bloque de noticias: ¿cambió el sitio?");

  const seen = new Set<number>();
  const out: FiubaNews[] = [];
  for (const [i, item] of ((block.noticias_ancladas ?? []) as Raw[]).entries()) {
    const n = item.noticia as Raw | undefined;
    const id = typeof n?.id === "number" ? n.id : null;
    const title = clean(str(n?.titulo));
    const slug = str(n?.seo_url);
    const publishedAt = str(n?.fecha_publicacion) ?? str(n?.published_at);
    if (!n || id === null || !title || !slug || !publishedAt || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title,
      summary: clean(str(n.bajada)),
      url: `${FIUBA_SITE}/noticias/${encodeURIComponent(slug)}`,
      imageUrl: imageOf(n.portada),
      publishedAt: new Date(publishedAt).toISOString(),
      rank: i,
    });
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
