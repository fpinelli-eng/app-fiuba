// Text of the "Recordarme" emails. Pure: the scheduled workflow "Recordatorios" (tools/reminders/)
// passes the due reminders here and sends what comes back. Runs in Node with type stripping, so only
// type annotations (no enums, no path aliases).

export const APP_URL = "https://app-fiuba.vercel.app";

export type DueReminder =
  | {
      id: number;
      kind: "exam";
      email: string;
      firstName: string | null;
      subject: string;
      /** "YYYY-MM-DDTHH:MM:SS", Buenos Aires time, the earliest close among the open tables. */
      enrollTo: string | null;
    }
  | { id: number; kind: "calendar"; email: string; firstName: string | null; title: string; /** "YYYY-MM-DD" */ endsOn: string };

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const WEEKDAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "2026-12-07T14:00:00" → "el lunes 7/12 a las 14:00"; "2026-11-14" → "el sábado 14/11". */
export function formatMoment(moment: string): string {
  const [date, time] = moment.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const day = `el ${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
  const hm = time?.slice(0, 5);
  return hm && hm !== "00:00" && hm !== "23:59" ? `${day} a las ${hm}` : day;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildEmail(r: DueReminder): Email {
  const hello = r.firstName ? `Hola, ${r.firstName}:` : "Hola:";
  const [subject, line, link, linkLabel] =
    r.kind === "exam"
      ? [
          `Abrió la inscripción al final de ${r.subject}`,
          `Ya te podés anotar en el SIU al final de ${r.subject}${r.enrollTo ? `. La inscripción cierra ${formatMoment(r.enrollTo)}` : ""}.`,
          `${APP_URL}/finales`,
          "Ver las mesas en FIUBI",
        ]
      : [
          `Empieza: ${r.title}`,
          `Desde hoy y hasta ${formatMoment(r.endsOn)}: ${r.title}.`,
          `${APP_URL}/novedades`,
          "Ver las próximas fechas en FIUBI",
        ];
  const footer = "Te llega este mail porque tocaste «Recordarme» en FIUBI. Es un solo aviso: no te vamos a escribir de nuevo por esto.";
  const text = `${hello}\n\n${line}\n\n${linkLabel}: ${link}\n\n—\n${footer}\n`;
  const html =
    `<p>${escape(hello)}</p><p>${escape(line)}</p>` +
    `<p><a href="${link}">${escape(linkLabel)}</a></p>` +
    `<p style="color:#5e667a;font-size:13px">${escape(footer)}</p>`;
  return { to: r.email, subject, text, html };
}
