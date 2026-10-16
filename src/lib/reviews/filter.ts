// Automatic filter for review comments (PRODUCTO.md 5.4): no insults, phone numbers, mails,
// links or social media handles. It runs while typing and again on the server before saving.
// It does not catch harsh criticism without insults, nor ads without contact data (accepted).

const BANNED = [
  "boludo", "boluda", "boludos", "boludas", "pelotudo", "pelotuda", "pelotudos", "pelotudas",
  "forro", "forra", "forros", "idiota", "idiotas", "imbecil", "imbeciles", "estupido", "estupida",
  "estupidos", "mierda", "puta", "puto", "putos", "carajo", "conchudo", "conchuda", "hdp", "hdmp",
  "tarado", "tarada", "garca", "garcas", "chanta", "chantas", "pajero", "pajera", "orto", "culiado",
  "culiau", "sorete", "soretes", "mogolico", "mogolica", "retrasado", "retrasada", "inutil", "inutiles",
];

export const COMMENT_MAX = 500;

const normalize = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The problem with a comment, as shown under the field, or null when it can be sent. */
export function commentProblem(text: string): string | null {
  const t = normalize(text);
  if (t.length > COMMENT_MAX) return `El comentario puede tener hasta ${COMMENT_MAX} caracteres.`;
  const words = t.split(/[^a-z0-9]+/);
  if (words.some((w) => BANNED.includes(w))) return "Tu comentario tiene palabras ofensivas. Sacalas para poder enviar la reseña.";
  const phone = /\d[\d\s.-]{6,}\d/.test(t);
  const contact = /https?:|www\.|\.(com|ar|net|org|io)\b|[a-z0-9._-]+@[a-z0-9-]+\.|(^|\s)@[a-z0-9_.]/.test(t);
  if (phone || contact) return "Las reseñas no pueden tener teléfonos, mails, links ni usuarios de redes.";
  return null;
}

export const STAR_LABELS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"] as const;
