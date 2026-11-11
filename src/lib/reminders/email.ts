// Text of the "Recordarme" mails. Pure: the workflow "Recordatorios" (tools/reminders/send.mjs)
// builds each mail here and sends it. Runs in Node with type stripping (type annotations only).

import { previousDay, type ReminderMailKind } from "./model";

export const FINALES_URL = "https://fiubi.com.ar/finales";

export interface ReminderMailInput {
  which: ReminderMailKind;
  /** Subject name as the app shows it: "Análisis Matemático II" */
  subjectName: string;
  table: {
    name: string;
    kind: string;
    /** "YYYY-MM-DD" */
    date: string;
    /** "HH:MM" */
    startTime: string | null;
    endTime: string | null;
    /** "YYYY-MM-DDTHH:MM", Buenos Aires time. */
    enrollTo: string;
  };
}

export interface ReminderMail {
  subject: string;
  text: string;
  html: string;
}

const WEEKDAY = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "2026-12-09" → "miércoles 9/12" */
export function longDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
}

/** "2026-12-07T14:00" → "el lunes 7/12 a las 14:00"; 00:00 is the end of the day before. */
export function deadline(enrollTo: string): string {
  const [date, time] = enrollTo.split("T");
  if (time === "00:00") return `el ${longDay(previousDay(date))} a las 23:59`;
  return `el ${longDay(date)} a las ${time}`;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildReminderMail(input: ReminderMailInput): ReminderMail {
  const { which, subjectName, table } = input;
  const subject =
    which === "first" ? `Abrió la inscripción al final de ${subjectName}` : `Último día para anotarte al final de ${subjectName}`;
  const time = table.startTime ? (table.endTime && table.endTime !== table.startTime ? ` de ${table.startTime} a ${table.endTime}` : ` a las ${table.startTime}`) : "";
  const kind = table.kind && table.kind !== "Regular" ? ` (${table.kind})` : "";
  const lines = [
    which === "first" ? `Ya te podés anotar en el SIU al final de ${subjectName}.` : `Hoy es el último día para anotarte en el SIU al final de ${subjectName}.`,
    `Mesa: ${table.name}${kind}, el ${longDay(table.date)}${time}.`,
    `La inscripción cierra ${deadline(table.enrollTo)}.`,
  ];
  const footer = "Para dejar de recibir estos avisos, sacá el recordatorio en Finales.";
  const text = `Hola:\n\n${lines.join("\n")}\n\nVer tus finales: ${FINALES_URL}\n\n—\n${footer}\n`;
  const html =
    `<p>Hola:</p><p>${lines.map(escapeHtml).join("<br>")}</p>` +
    `<p><a href="${FINALES_URL}">Ver tus finales en FIUBI</a></p>` +
    `<p style="font-size:13px">${escapeHtml(footer)}</p>`;
  return { subject, text, html };
}
