import { describe, expect, it } from "vitest";
import { buildReminderMail, deadline, longDay } from "./email";

const table = {
  name: "MESA 01",
  kind: "Regular",
  date: "2026-12-09",
  startTime: "17:00",
  endTime: "20:00",
  enrollTo: "2026-12-07T14:00",
};

describe("reminder mails", () => {
  it("formats days and deadlines", () => {
    expect(longDay("2026-12-09")).toBe("miércoles 9/12");
    expect(deadline("2026-12-07T14:00")).toBe("el lunes 7/12 a las 14:00");
    expect(deadline("2026-12-08T00:00")).toBe("el lunes 7/12 a las 23:59");
  });

  it("writes the first-day mail", () => {
    const mail = buildReminderMail({ which: "first", subjectName: "Análisis Matemático II", table });
    expect(mail.subject).toBe("Abrió la inscripción al final de Análisis Matemático II");
    expect(mail.text).toContain("Mesa: MESA 01, el miércoles 9/12 de 17:00 a 20:00.");
    expect(mail.text).toContain("La inscripción cierra el lunes 7/12 a las 14:00.");
    expect(mail.text).toContain("https://fiubi.com.ar/finales");
    expect(mail.text).toContain("Para dejar de recibir estos avisos, sacá el recordatorio en Finales.");
  });

  it("writes the last-day mail, with the kind when it is not Regular", () => {
    const mail = buildReminderMail({
      which: "last",
      subjectName: "Álgebra Lineal",
      table: { ...table, name: "MESA PARA RENDIR LIBRE", kind: "Libre", startTime: null, endTime: null },
    });
    expect(mail.subject).toBe("Último día para anotarte al final de Álgebra Lineal");
    expect(mail.text).toContain("Mesa: MESA PARA RENDIR LIBRE (Libre), el miércoles 9/12.");
  });

  it("escapes the HTML version", () => {
    const mail = buildReminderMail({ which: "first", subjectName: "Física <I> & Co", table });
    expect(mail.html).toContain("Física &lt;I&gt; &amp; Co");
    expect(mail.html).not.toContain("<I>");
  });
});
