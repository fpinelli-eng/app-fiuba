# Recordatorios de finales ("Recordarme")

En Finales, el alumno toca **Recordarme**, tilda las mesas que quiere y toca **Aceptar**. Se guardan en `exam_reminders` (migración `20261113150000_exam_reminders.sql`). Por cada mesa le llegan dos mails a su cuenta @fi.uba.ar: el primer día de la inscripción y el último.

## Cómo decide qué mandar

El workflow **"Recordatorios"** (`.github/workflows/reminders.yml`) corre cada 3 horas desde las 08:17 de Buenos Aires y también a mano (Actions → Recordatorios → Run workflow):

1. `due.sql` lee los recordatorios con algún mail pendiente (del plan actual del alumno y con examen de hoy en adelante) y las mesas de `exam_tables` que les pueden corresponder. Se escribe en un archivo del runner, nunca en el log: tiene los mails.
2. `send.mjs` empareja cada recordatorio con la mesa de **hoy** por clave natural (plan, código del SIU, nombre, tipo y fecha), porque la sincronización diaria del SIU (`tools/exams/`) reemplaza las filas y cambia los ids. Si el SIU movió la inscripción, usa las fechas nuevas; si la mesa ya no está, no manda nada y el recordatorio queda. La regla está en `dueMail()` (`src/lib/reminders/model.ts`, con pruebas):
   - **Primer mail:** cuando abrió la inscripción, desde las 8 del primer día. No va si el alumno lo pidió con la inscripción ya abierta.
   - **Último mail:** el último día, desde las 8 y mientras siga abierta. Si cierra a la mañana (antes de las 12) o a las 00:00, el último día es el anterior. Si para entonces el primero no salió (inscripción de un día, recordatorio tardío), va solo este.
3. `mark.sql` marca lo que salió (`first_sent_at`, `last_sent_at`: solo el dueño de la base puede) y borra los recordatorios de exámenes que ya pasaron.

Cada mail sale una sola vez. Si el envío de uno falla, no se marca y se reintenta en la corrida siguiente.

## Configuración

Secretos del repo (Settings → Secrets and variables → Actions):

- `SUPABASE_DB_PASSWORD`: el mismo de "Base de datos".
- La casilla de mail del proyecto: `SMTP_HOST`, `SMTP_PORT` (465 con TLS o 587 con STARTTLS), `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` (por ejemplo `FIUBI <avisos@fiubi.com.ar>`).

**Sin los secretos `SMTP_*`** el workflow solo cuenta cuántos avisos esperan y no marca nada: se puede integrar antes de tener la casilla.

La casilla es `avisos@fiubi.com.ar`: envía Brevo (plan gratis, 300 mails por día, dominio autenticado con DKIM y DMARC) y recibe ImprovMX, que reenvía todo `@fiubi.com.ar` a los dos administradores.

## Mail de control

Para probar el envío: Actions → Recordatorios → **Run workflow** (con "Mandar mail de control" tildado). Además de los recordatorios que toquen, manda un mail "FIUBI: mail de control" a la propia casilla (`SMTP_FROM`), que les llega a los administradores, con cantidades y nada más. Lo mismo pasa solo el 1.º de cada mes a las 10:23: Brevo vence la clave SMTP tras 90 días sin uso, y en meses sin recordatorios nadie la usaría.

Si un envío falla, la corrida termina en error (GitHub avisa por mail) y el resumen muestra solo el código: `EAUTH` o `535` es la clave (vencida o mal cargada en `SMTP_PASS`); `ESOCKET` o `ECONNECTION`, el servidor o el puerto. La clave vence además a la fecha elegida al crearla (un año): se genera otra en Brevo → SMTP & API → SMTP y se reemplaza `SMTP_PASS`.

El cliente de mail es `nodemailer`, instalado con versión fija solo dentro del workflow (no está en `package.json`).

## Privacidad

El repo es público: el log y el resumen de cada corrida muestran solo cantidades, nunca mails, nombres ni mensajes de error del servidor de mail (pueden incluir la dirección).

## Probarlo en tu computadora

Con un JSON como el que imprime `due.sql` (sin SMTP solo cuenta; no manda nada):

```
node --experimental-strip-types tools/reminders/send.mjs --dump due.json --sent sent.json --now 2026-11-30T08:17 [--control]
```
