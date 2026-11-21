// Text of the Historia académica PDF, read in the browser with PDF.js (pdfjs-dist): the file never
// leaves the device. PDF.js is loaded only when the student opens the importer (dynamic import),
// with its worker as a module Worker that the bundler emits as its own file.
//
// PDF.js gives positioned pieces of text, not lines: textLines() groups them by height on the page
// (a row of the table is one line) and orders each line from left to right.

/** A piece of text as PDF.js gives it (TextItem): transform[4] is x, transform[5] is y. */
export interface PdfTextPiece {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** Lines of one page, top to bottom. Pure, so it can be tested without a PDF. */
export function textLines(pieces: PdfTextPiece[]): string[] {
  const items = pieces
    .filter((p) => p.str.trim() !== "")
    .map((p) => ({ str: p.str, x: p.transform[4], y: p.transform[5], w: p.width, h: Math.abs(p.height) || Math.abs(p.transform[3]) || 10 }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: { y: number; h: number; items: typeof items }[] = [];
  for (const it of items) {
    // Same line if the baselines are closer than half the text height.
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(2, Math.min(l.h, it.h) * 0.5));
    if (line) line.items.push(it);
    else lines.push({ y: it.y, h: it.h, items: [it] });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      const sorted = l.items.sort((a, b) => a.x - b.x);
      let text = "";
      let end: number | null = null;
      for (const it of sorted) {
        // A gap wider than a fraction of the text height is a space; pieces of one word touch.
        const gap = end === null ? 0 : it.x - end;
        if (end !== null && gap > it.h * 0.15 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
        text += it.str;
        end = it.x + it.w;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

/** The PDF is not readable (damaged, with a password, or not a PDF). */
export class PdfReadError extends Error {}

const MAX_PAGES = 40;

/** Every line of the PDF, page after page. Browser only. */
export async function readPdfLines(data: ArrayBuffer): Promise<string[]> {
  // The legacy build also works on older phones (the modern one needs very recent browsers).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(data), enableXfa: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new PdfReadError(e instanceof Error ? e.message : String(e));
  }
  try {
    const lines: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      lines.push(...textLines(content.items.flatMap((i) => ("str" in i ? [i] : []))));
      page.cleanup();
    }
    return lines;
  } finally {
    void task.destroy();
  }
}
