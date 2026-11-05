// Fetching the public "Fechas de examen" page of the SIU by its link. The page needs no login:
// after "Buscar", the SIU puts the filters in the address (formulario_filtro[carrera]=…), so the
// admin copies that link and the server downloads the results, with the "Ver" details.

export const SIU_EXAMS_HOST = "guaraniautogestion.fi.uba.ar";
export const SIU_EXAMS_PATH = "/g3w/fecha_examen";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5_000_000;

/** Whether the pasted input is a link (otherwise it is the copied text of the page). */
export function isLink(input: string): boolean {
  const s = input.trim();
  return !/\s/.test(s) && /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}\//i.test(s);
}

/** Checks that a link is the SIU's "Fechas de examen" search, with its filters. */
export function siuExamsUrl(input: string): { url: string } | { error: string } {
  let url: URL;
  try {
    const s = input.trim();
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return { error: "El enlace no es válido." };
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (url.hostname !== SIU_EXAMS_HOST || path !== SIU_EXAMS_PATH || url.username || url.password || url.port) {
    return { error: `El enlace tiene que ser de la página Fechas de examen del SIU (${SIU_EXAMS_HOST}${SIU_EXAMS_PATH}).` };
  }
  if (!url.searchParams.has("formulario_filtro[carrera]")) {
    return { error: "El enlace no tiene la búsqueda: en el SIU elegí carrera y plan, tocá Buscar y copiá el enlace de nuevo." };
  }
  url.protocol = "https:";
  url.hash = "";
  return { url: url.toString() };
}

/** The page's text: the SIU answers in ISO-8859-1 unless the response says otherwise. */
export function decodeSiuPage(bytes: ArrayBuffer, contentType: string | null): string {
  const charset = contentType?.match(/charset=["']?([\w-]+)/i)?.[1].toLowerCase();
  return new TextDecoder(charset === "utf-8" || charset === "utf8" ? "utf-8" : "latin1").decode(bytes);
}

// If the SIU can't be reached from the server (or blocks it), the copied text still works, without times.
export const PASTE_TEXT_INSTEAD =
  " Si sigue sin andar, copiá la página del SIU (Ctrl+A, Ctrl+C) y pegá el texto acá: se cargan las fechas, sin horarios.";

/** Downloads the page of a link already checked with siuExamsUrl(). Server only. */
export async function fetchSiuExamsPage(url: string): Promise<{ html: string } | { error: string }> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/html" },
    });
    if (res.status !== 200) return { error: `El SIU respondió con un error (${res.status}). Probá de nuevo en un rato.${PASTE_TEXT_INSTEAD}` };
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return { error: "La página del SIU es demasiado grande." };
    return { html: decodeSiuPage(bytes, res.headers.get("content-type")) };
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { error: (timeout ? "El SIU tardó demasiado en responder. Probá de nuevo." : "No pudimos conectarnos con el SIU.") + PASTE_TEXT_INSTEAD };
  }
}
