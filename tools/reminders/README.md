# Recordatorios de finales ("Recordarme")

En Finales, el alumno toca **Recordarme**, tilda las mesas que quiere y toca **Aceptar**. Se guardan en `exam_reminders` (migración `20261113150000_exam_reminders.sql`). Por cada mesa le llega un mail a su cuenta @fi.uba.ar cuando abre la inscripción (decisión de Francisco, 12 de noviembre de 2026: sin mail del último día). El diálogo solo ofrece mesas con la inscripción por abrir.

## Cómo decide qué mandar

El workflow **"Recordatorios"** (`.github/workflows/reminders.yml`) corre cada una hora (a los :17; GitHub saltea algunas corridas programadas, y así igual sale alguna por hora) y también a mano (Actions → Recordatorios → Run workflow):

1. `due.sql` lee los recordatorios con algún mail pendiente (del plan actual del alumno y con examen de hoy en adelante) y las mesas de `exam_tables` que les pueden corresponder. Se escribe en un archivo del runner, nunca en el log: tiene los mails.
2. `send.mjs` empareja cada recordatorio con la mesa de **hoy** por clave natural (plan, código del SIU, nombre, tipo y fecha), porque la sincronización diaria del SIU (`tools/exams/`) reemplaza las filas y cambia los ids. Si el SIU movió la inscripción, usa las fechas nuevas; si la mesa ya no está, no manda nada y el recordatorio queda. La regla está en `dueMail()` (`src/lib/reminders/model.ts`, con pruebas):
   - **Mail de apertura:** una sola vez, desde las 8 del primer día de la inscripción y mientras siga abierta (si GitHub se salteó la corrida de esa mañana, sale en la siguiente). No va si el alumno lo pidió con la inscripción ya abierta ni si el SIU no da fecha de apertura.
3. `mark.sql` marca lo que salió (`first_sent_at`: solo el dueño de la base puede) y borra los recordatorios de exámenes que ya pasaron. `last_sent_at` quedó de la primera versión, que también avisaba el último día: ya no se escribe.

Cada mail sale una sola vez. Si el envío de uno falla, no se marca y se reintenta en la corrida siguiente.

## Configuración

Secretos del repo (Settings → Secrets and variables → Actions):

- `SUPABASE_DB_PASSWORD`: el mismo de "Base de datos".
- La casilla de mail del proyecto: `SMTP_HOST`, `SMTP_PORT` (465 con TLS o 587 con STARTTLS), `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` (por ejemplo `FIUBI <avisos@fiubi.com.ar>`).

**Sin los secretos `SMTP_*`** el workflow solo cuenta cuántos avisos esperan y no marca nada: se puede integrar antes de tener la casilla.

La casilla es `avisos@fiubi.com.ar`: envía Brevo (plan gratis, 300 mails por día, dominio autenticado con DKIM y DMARC) y recibe ImprovMX, que reenvía todo `@fiubi.com.ar` a los dos administradores.

## Mail de control

Para probar el envío: Actions → Recordatorios → **Run workflow** (con "Mandar mail de control" tildado). Además de los recordatorios que toquen, manda un mail "FIUBI: mail de control" a `SMTP_CONTROL_TO` (secreto con los @fi.uba.ar de los administradores, separados por coma: el mismo tipo de casilla que tienen los alumnos), con cantidades y nada más. Sin ese secreto va a la propia casilla (`SMTP_FROM`), pero ahí puede rebotar: ImprovMX rechaza los mails que salen de IPs en listas negras como SpamCop, y las IPs compartidas de Brevo a veces lo están (`551 5.7.1 … black listed by SpamCop`). Google, que recibe los mails de los alumnos, no rechaza por eso. Lo mismo pasa solo el 1.º de cada mes a las 10:23: Brevo vence la clave SMTP tras 90 días sin uso, y en meses sin recordatorios nadie la usaría.

Si un envío falla, la corrida termina en error (GitHub avisa por mail) y el resumen muestra solo el código: `EAUTH` o `535` es la clave (vencida o mal cargada en `SMTP_PASS`); `ESOCKET` o `ECONNECTION`, el servidor o el puerto. La clave vence además a la fecha elegida al crearla (un año): se genera otra en Brevo → SMTP & API → SMTP y se reemplaza `SMTP_PASS`.

El cliente de mail es `nodemailer`, instalado con versión fija solo dentro del workflow (no está en `package.json`).

## Privacidad

El repo es público: el log y el resumen de cada corrida muestran solo cantidades, nunca mails, nombres ni mensajes de error del servidor de mail (pueden incluir la dirección).

## Probarlo en tu computadora

Con un JSON como el que imprime `due.sql` (sin SMTP solo cuenta; no manda nada):

```
node --experimental-strip-types tools/reminders/send.mjs --dump due.json --sent sent.json --now 2026-11-30T08:17 [--control]
```
