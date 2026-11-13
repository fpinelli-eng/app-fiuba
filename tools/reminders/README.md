# Recordatorios de finales ("Recordarme")

En Finales, el alumno toca **Recordarme**, tilda las mesas que quiere y toca **Aceptar**. Se guardan en `exam_reminders` (migración `20261113150000_exam_reminders.sql`). Por cada mesa le llega un mail a su cuenta @fi.uba.ar cuando abre la inscripción (decisión de Francisco en #114, confirmada por Tomás: sin mail del último día). El diálogo solo ofrece mesas con la inscripción por abrir.

Los mails salen de la cuenta de Google del proyecto, **avisosfiubi@gmail.com**, con un Apps Script pegado en una planilla de esa cuenta. No depende de GitHub Actions.

## Cómo funciona

Una vez por hora, el script (`apps-script/Code.gs`, función `hourly`):

1. Le pregunta a la base qué recordatorios hay y a cuáles les toca el mail ahora (`avisos_pendientes()`, migración `20261114120000_avisos_rpc.sql`). La base vuelve a leer cada mesa en `exam_tables` por materia, nombre, tipo y fecha (la sincronización diaria del SIU cambia los ids): si el SIU movió la inscripción, usa las fechas nuevas. De paso borra los recordatorios de exámenes que ya pasaron.
2. Desde las 8 de la mañana manda los mails que tocan y, después de **cada** mail, lo marca en la base (`avisos_marcar_enviado()`). La base no lo vuelve a ofrecer nunca, aunque alguien toque la planilla.
3. Reescribe la pestaña **Recordatorios** de la planilla con todos los recordatorios: es solo una copia para mirar. Editarla no cambia nada.

Reglas (están en la base, con pruebas en `tools/db-test/security.sql`):

- Una sola vez, una vez abierta la inscripción y desde las 8 del primer día. Si el script no corrió esa mañana, sale en la corrida siguiente mientras la inscripción siga abierta.
- No va si el alumno lo pidió con la inscripción ya abierta, ni si el SIU no da fecha de apertura o de cierre.
- Nunca antes de las 8, nunca con la inscripción cerrada, nunca dos veces (tampoco a quien ya lo recibió por el envío anterior, desde GitHub). Solo a cuentas @fi.uba.ar y a mesas del plan actual del alumno.

**Límite de Gmail:** una cuenta gratuita manda unos 100 mails por día. Si en un día tocan más, el script para y manda el resto al otro día (mientras la inscripción siga abierta).

**Seguridad:** el script entra a la base con la clave pública de la app (la misma que usa la web) y un token propio. Con esa clave solo se pueden usar esas dos funciones, y sin el token devuelven error. La base guarda solo el SHA-256 del token, en `avisos_config`, que nadie puede leer desde la app. El token está únicamente en las propiedades del script.

**Lo que sigue dependiendo de GitHub:** la migración se aplica una sola vez al integrar el PR (workflow "Base de datos"), y las fechas de examen las sigue trayendo cada mañana el workflow "Fechas de examen del SIU". Si GitHub se saltea un día, las fechas quedan un día viejas, pero los mails siguen saliendo.

## Puesta en marcha (Tomás)

Todo desde la cuenta **avisosfiubi@gmail.com**.

1. **Crear la planilla.** En [Google Sheets](https://sheets.google.com), planilla nueva en blanco. Ponele de nombre "Recordatorios FIUBI".
2. **Abrir el editor de scripts.** En la planilla: **Extensiones → Apps Script**. Se abre una pestaña nueva con un archivo `Código.gs`.
3. **Pegar el código.**
   - Borrá lo que tiene `Código.gs` y pegá todo el contenido de [`apps-script/Code.gs`](apps-script/Code.gs) (en GitHub, botón "Copy raw file").
   - Tocá el engranaje de la izquierda (**Configuración del proyecto**) y tildá **"Mostrar el archivo de manifiesto appsscript.json en el editor"**.
   - Volvé al editor (ícono `< >`), abrí `appsscript.json`, borrá lo que tiene y pegá [`apps-script/appsscript.json`](apps-script/appsscript.json).
   - Guardá (ícono del disquete o Ctrl+S).
4. **Primera prueba: `sendTestMail`.** Arriba, en el menú desplegable de funciones, elegí `sendTestMail` y tocá **Ejecutar**. La primera vez Google pide permisos:
   - **Revisar permisos** → elegí la cuenta avisosfiubi@gmail.com.
   - Aparece **"Google no verificó esta app"**: es lo esperado, porque el script es nuestro y no está publicado. Tocá **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**.
   - Te llega a avisosfiubi@gmail.com un mail de prueba ("[Prueba] Abrió la inscripción al final de…"). No toca la base ni la planilla. El logo se ve recién cuando el PR esté integrado (sale de fiubi.com.ar).
5. **Crear el token.** Elegí `createToken` y tocá **Ejecutar**. En el **Registro de ejecución** de abajo aparece una línea que empieza con `insert into public.avisos_config`. Copiala entera.
6. **Guardar el token en la base** (desde acá, con el PR ya integrado). En [Supabase](https://supabase.com/dashboard) → proyecto de FIUBI → **SQL Editor** → pegá la línea → **Run**. Tiene que decir "Success". (La línea tiene solo el hash del token, no el token.) Esto se hace después de que el PR esté integrado: antes la tabla no existe.
7. **Cargar la clave pública.** En Apps Script → **Configuración del proyecto** → **Propiedades de la secuencia de comandos** (en inglés, *Script Properties*) → **Agregar propiedad**:
   - Propiedad `SUPABASE_KEY`, valor: la clave pública de la app, la que empieza con `sb_publishable_`. Está en el `.env.local` (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), en Vercel → Settings → Environment Variables, o en Supabase → Project Settings → API Keys ("Publishable key"). No es secreta: es la misma que usa la web.
   - `TOKEN` ya está (lo creó el paso 5). No hace falta `SUPABASE_URL`: el script ya sabe la dirección del proyecto (`https://solnlrkmkncsntyptjjm.supabase.co`).
   - Guardá las propiedades.
8. **Probar la planilla.** Elegí `syncSheet` y tocá **Ejecutar**. En la planilla aparece la pestaña **Recordatorios** con los recordatorios que haya, sin mandar ningún mail. Si da error, el registro dice qué falta (por ejemplo, "¿TOKEN o SUPABASE_KEY mal copiados?").
9. **Prender el reloj.** Elegí `installTriggers` y tocá **Ejecutar**. Desde ahí, `hourly` corre sola una vez por hora (se ve en el ícono del reloj, **Activadores**). Correrla dos veces no la duplica.

Listo. Para ver qué pasó en cada corrida: Apps Script → **Ejecuciones** (a la izquierda). Si una falla, Google te manda un mail.

## Monitor (avisa por mail cuando algo se rompe)

En la misma planilla, un segundo archivo, `apps-script/Salud.gs`, revisa cada hora si la app anda y les manda un mail a los administradores **solo cuando aparece un problema o cuando se resuelve** (un mail con la lista de lo que está mal), como mucho 4 por día. No usa GitHub Actions: corre dentro de `hourly`, después de los recordatorios y por separado (si uno falla, el otro corre igual). Lo mismo se ve en **Administración → Estado** (https://fiubi.com.ar/admin/estado).

Qué revisa (los límites están en `SALUD_LIMITS`, al principio de `Salud.gs`):

| Chequeo | Avisa si… |
|---|---|
| La base responde (`salud()`, migración `20261115130000_salud.sql`, con el mismo `TOKEN`) | da error: base caída, `TOKEN` o `SUPABASE_KEY` mal |
| Fechas de examen del SIU (el workflow corre todas las mañanas) | la última lectura tiene más de 36 h: GitHub se salteó corridas o el SIU no responde |
| Noticias de la FIUBA (una vez por día) | la última copia tiene más de 48 h |
| Mails de Recordarme | uno tenía que salir hace más de 3 h y sigue sin mandarse |
| https://fiubi.com.ar y https://fiubi.com.ar/robots.txt | no responden 200 **dos veces seguidas** (una sola falla no avisa) |

La base le devuelve solo cantidades y fechas (nunca mails ni nombres) y el mail tiene solo eso, con un botón a Administración → Estado. Cada llamada anota la hora en la base, así la página de Estado muestra "Último chequeo del monitor: hace X" y avisa ⚠️ "El monitor no está corriendo" si pasaron más de 2 horas.

### Ponerlo en marcha (Tomás)

Con la planilla de arriba ya andando y el PR del monitor integrado (antes la base no tiene `salud()`):

1. **Pegar `Salud.gs`.** En Apps Script, al lado de **Archivos**, tocá **+** → **Secuencia de comandos**, ponele de nombre `Salud` y pegá todo el contenido de [`apps-script/Salud.gs`](apps-script/Salud.gs). Guardá.
2. **Actualizar `Código.gs`.** Borrá su contenido y pegá de nuevo [`apps-script/Code.gs`](apps-script/Code.gs): cambió `hourly` para que llame al monitor. Guardá. El activador sigue igual (no hace falta `installTriggers`) y `appsscript.json` no cambió.
3. **A quién le llegan los avisos.** **Configuración del proyecto** → **Propiedades de la secuencia de comandos** → **Agregar propiedad**: `ALERT_TO`, valor: los mails separados por coma (por ejemplo, el tuyo y el de Francisco de la FIUBA). Escribilos vos ahí: no van en el repo. Si no existe, el aviso le llega a avisosfiubi@gmail.com.
4. **Probar sin mandar nada.** Elegí `saludProbar` y tocá **Ejecutar**. En el registro aparece cada chequeo con ✅ o ⚠️ y si en una corrida normal mandaría un mail. Si Google pide permisos de nuevo, aceptá como en el paso 4 de arriba.
5. **Mail de prueba.** Elegí `saludMailDePrueba` y tocá **Ejecutar**: les llega a los de `ALERT_TO` un aviso de ejemplo ("[Prueba] FIUBI: 2 problemas"). No toca la base ni lo que el monitor recuerda.

Listo: desde la próxima hora corre solo. Lo que recuerda (qué avisó y cuántas veces falló la web) está en la propiedad `SALUD_STATE`; borrarla lo hace empezar de cero.

**Si falla el script entero** (por ejemplo, Google cambió algo o se venció un permiso), Google manda el aviso de error a **avisosfiubi@gmail.com**, no a `ALERT_TO`. Revisá esa casilla de vez en cuando o configurá en Gmail que reenvíe esos mails (remitente `apps-scripts-notifications@google.com`) a tu cuenta.

### Lo que no ve

- Errores en las pantallas con sesión (Mapa, Plan, Finales…): el monitor no entra con una cuenta, solo mira la página pública y `robots.txt`.
- Problemas que pasan solo en el navegador de un alumno (JavaScript que falla en un celular, una pantalla que se ve mal).
- Si se cae la cuenta de Google o Apps Script, no hay quién avise (por eso Estado muestra cuándo fue el último chequeo).
- Que los datos estén bien: sabe que las fechas de examen se leyeron hace poco, no si el SIU las publicó correctas.

## Cambiar algo después

- **Cambiar el código o el diseño del mail:** se cambia `apps-script/Code.gs` en el repo (con PR) y después se vuelve a pegar en el editor de Apps Script y se guarda. No hace falta tocar nada más: el activador sigue andando con el código nuevo.
- **Ver el diseño sin mandar nada:** abrí `apps-script/preview.html` en el navegador (el mail con datos de ejemplo). Si cambiás el mail en `Code.gs`, regeneralo con `node tools/reminders/apps-script/preview.mjs` (las pruebas avisan si quedó viejo).
- **Cambiar el token:** en Propiedades del script borrá `TOKEN`, corré `createToken` y pegá la línea nueva en el SQL Editor.
- **Frenar todo:** en **Activadores**, borrá el de `hourly` (frena también el monitor).

## Privacidad

La planilla tiene mails de alumnos: no la compartas con nadie más. El registro de ejecuciones muestra solo cantidades. La política de privacidad (`src/app/privacidad/page.tsx`) dice que los datos de los recordatorios se copian a esta planilla y que los mails salen de esta cuenta.
