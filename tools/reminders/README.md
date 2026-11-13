# Recordatorios de finales ("Recordarme")

En Finales, el alumno toca **Recordarme**, tilda las mesas que quiere y toca **Aceptar**. Se guardan en `exam_reminders` (migración `20261113150000_exam_reminders.sql`). Por cada mesa le llega un mail a su cuenta @fi.uba.ar (o al otro mail que elija en Recordarme) cuando abre la inscripción (decisión de Francisco en #114, confirmada por Tomás: sin mail del último día). El diálogo solo ofrece mesas con la inscripción por abrir.

Los mails salen de la cuenta de Google del proyecto, **avisosfiubi@gmail.com**, con un Apps Script pegado en una planilla de esa cuenta. No depende de GitHub Actions.

## Cómo funciona

Una vez por hora, el script (`apps-script/Code.gs`, función `hourly`):

1. Le pregunta a la base qué recordatorios hay y a cuáles les toca el mail ahora (`avisos_pendientes()`, migración `20261114120000_avisos_rpc.sql`). La base vuelve a leer cada mesa en `exam_tables` por materia, nombre, tipo y fecha (la sincronización diaria del SIU cambia los ids): si el SIU movió la inscripción, usa las fechas nuevas. De paso borra los recordatorios de exámenes que ya pasaron.
2. Desde las 8 de la mañana manda los mails que tocan y, después de **cada** mail, lo marca en la base (`avisos_marcar_enviado()`). La base no lo vuelve a ofrecer nunca, aunque alguien toque la planilla.
3. Reescribe la pestaña **Recordatorios** de la planilla con todos los recordatorios: es solo una copia para mirar. Editarla no cambia nada.

Reglas (están en la base, con pruebas en `tools/db-test/security.sql`):

- Una sola vez, una vez abierta la inscripción y desde las 8 del primer día. Si el script no corrió esa mañana, sale en la corrida siguiente mientras la inscripción siga abierta.
- No va si el alumno lo pidió con la inscripción ya abierta, ni si el SIU no da fecha de apertura o de cierre.
- Nunca antes de las 8, nunca con la inscripción cerrada, nunca dos veces (tampoco a quien ya lo recibió por el envío anterior, desde GitHub). Solo a cuentas @fi.uba.ar (al otro mail del alumno si eligió uno) y a mesas del plan actual del alumno.

**Límite de Gmail:** una cuenta gratuita manda unos 100 mails por día. Si en un día tocan más, el script para y manda el resto al otro día (mientras la inscripción siga abierta).

**Seguridad:** el script entra a la base con la clave pública de la app (la misma que usa la web) y un token propio. Con esa clave solo se pueden usar las funciones `avisos_*` y `salud()`, y sin el token devuelven error. La base guarda solo el SHA-256 del token, en `avisos_config`, que nadie puede leer desde la app. El token está en las propiedades del script y, si se usa el camino al instante del mail de confirmación, también en Vercel (`AVISOS_WEBAPP_TOKEN`, solo del servidor).

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

## Mail de confirmación y otro mail

Los mails salen de una cuenta de Gmail nueva y externa a la facultad, así que en las cuentas @fi.uba.ar (Google Workspace) muchas veces caen en **Spam**. Para que el alumno lo arregle antes del aviso de verdad, al activar sus recordatorios le llega enseguida **un mail de confirmación** ("Activaste tus recordatorios de FIUBI", `buildConfirmMail_()` en `Code.gs`): cuántas mesas eligió y que, si le llegó a Spam, toque **"No es spam"** y agregue avisosfiubi@gmail.com a sus contactos. La app le dice lo mismo al tocar **Aceptar** (`ReminderMail.tsx`).

- **Cuándo:** una vez por alumno y dirección, primero los que eligieron mesas más recientemente (migración `20261116120000_recordarme_confirmacion.sql`). Sale cuando tiene al menos un recordatorio de su plan con el examen por delante y su última confirmación fue a otra dirección (o nunca recibió una): la primera vez que activa recordatorios, y de nuevo solo si cambia el mail. Sacar todas las mesas y volver a elegir no manda otra. Como el otro mail puede ser cualquiera, como mucho 3 por alumno cada 24 horas (las demás esperan). Los alumnos que ya tenían recordatorios antes de esta versión reciben la suya en las primeras corridas.
- **Otro mail:** en Recordarme, "¿Preferís recibir los avisos en otro mail?" (cualquier dominio). Se guarda en `profiles.reminder_email` solo con `set_my_reminder_email()`; vacío vuelve a la cuenta @fi.uba.ar. `avisos_pendientes()` manda a ese mail cuando existe (la cuenta tiene que seguir siendo @fi.uba.ar). Los administradores no lo ven.
- **Cómo sale:** `hourly()`, después de los recordatorios y a cualquier hora, le pide a la base `avisos_confirmaciones()` (mismo `TOKEN`), manda cada una y la marca enseguida con `avisos_confirmacion_enviada()`. Deja `CONFIRM_QUOTA_RESERVE` (30) mails de la cuota diaria para los recordatorios: si no alcanza, salen en la corrida siguiente. Para probar el diseño sin tocar nada: `sendTestConfirmMail` (y `preview.html` lo muestra junto al del recordatorio).
- **Al instante (opcional):** sin nada más, la confirmación sale en la corrida de cada hora. Si el script se publica como aplicación web, la app le avisa al guardar y sale en unos minutos. La app dice "en unos minutos" en los dos casos (texto simple a propósito).

### Puesta en marcha (Tomás)

Con este PR integrado (antes la base no tiene las funciones nuevas):

1. **Actualizar `Código.gs`.** Borrá su contenido y pegá de nuevo [`apps-script/Code.gs`](apps-script/Code.gs). Guardá. Hacelo apenas se integre el PR: hasta entonces el código viejo no manda los recordatorios a quien eligió otro mail.
2. **Actualizar `appsscript.json`.** Pegá de nuevo [`apps-script/appsscript.json`](apps-script/appsscript.json) (suma la configuración de la aplicación web; no pide permisos nuevos).
3. **Probar el diseño.** Elegí `sendTestConfirmMail` y tocá **Ejecutar**: te llega a avisosfiubi@gmail.com un "[Prueba] Activaste tus recordatorios de FIUBI". No toca la base.
4. Listo: desde la próxima hora salen las confirmaciones. Para mandarlas ya, ejecutá `sendConfirmations`.

### Al instante: publicar la aplicación web (opcional, Tomás + Francisco)

1. **Tomás, en Apps Script:** **Implementar → Nueva implementación** → engranaje → **Aplicación web**. Descripción: "Confirmaciones". **Ejecutar como: Yo (avisosfiubi@gmail.com)**. **Quién tiene acceso: Cualquier persona**. **Implementar** (si pide permisos, aceptá como en el paso 4 de arriba). Copiá la **URL de la aplicación web** (empieza con `https://script.google.com/macros/s/` y termina en `/exec`).
   - "Cualquier persona" es necesario porque la llama el servidor de la app, sin cuenta de Google. Sin el token no hace nada: `doPost()` compara el token del pedido con `TOKEN` y solo responde cantidades.
2. **Pasarle a Francisco** (por un canal privado, no en GitHub): la URL y el valor de `TOKEN` (Configuración del proyecto → Propiedades de la secuencia de comandos). Puede ser el mismo `TOKEN` que ya usa el script.
3. **Francisco, en Vercel:** proyecto → **Settings → Environment Variables** → agregar `AVISOS_WEBAPP_URL` (la URL) y `AVISOS_WEBAPP_TOKEN` (el token), para **Production** (y Preview si se quiere probar; las vistas previas usan la misma base). **Nunca** con `NEXT_PUBLIC_`: solo las lee el servidor. Después, **Redeploy** de producción para que las tome.
4. **Probar:** en la app, elegí una mesa en Recordarme con una cuenta que nunca recibió la confirmación (o cambiá el otro mail) y tocá Aceptar: en unos minutos llega el mail. En Apps Script → **Ejecuciones** aparece `doPost`.

**Ojo al cambiar el código:** una aplicación web sigue corriendo la versión con la que se publicó. Después de pegar un `Code.gs` nuevo: **Implementar → Administrar implementaciones** → lápiz → **Versión: Nueva versión** → **Implementar** (la URL no cambia). El activador de `hourly` siempre usa el código guardado. **Si se cambia `TOKEN`**, hay que cambiarlo también en Vercel (`AVISOS_WEBAPP_TOKEN`): si no, la app no lo puede llamar y las confirmaciones salen solo cada hora. Para apagar el camino rápido, alcanza con borrar las dos variables en Vercel (o archivar la implementación).

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

Listo: desde la próxima hora corre solo.

**El primer día puede llegar un aviso de "Las fechas de examen no se actualizan"** seguido de otro "todo volvió a andar": hasta que corra la sincronización del SIU con el código nuevo (la mañana siguiente a integrar el PR), la base solo sabe la última vez que *cambiaron* las fechas. Para evitarlo, hacé estos pasos después de esa corrida (en GitHub → Actions → "Fechas de examen del SIU" se ve si ya corrió). Lo que recuerda (qué avisó y cuántas veces falló la web) está en la propiedad `SALUD_STATE`; borrarla lo hace empezar de cero.

**Si falla el script entero** (por ejemplo, Google cambió algo o se venció un permiso), Google manda el aviso de error a **avisosfiubi@gmail.com**, no a `ALERT_TO`. En **Activadores**, editá el de `hourly` y fijate que en **Configuración de notificaciones de errores** diga "Notificarme inmediatamente" (o "a diario"). Revisá esa casilla de vez en cuando o configurá en Gmail que reenvíe esos avisos de Google a tu cuenta.

### Lo que no ve

- Errores en las pantallas con sesión (Mapa, Plan, Finales…): el monitor no entra con una cuenta, solo mira la página pública y `robots.txt`.
- Problemas que pasan solo en el navegador de un alumno (JavaScript que falla en un celular, una pantalla que se ve mal).
- Si se cae la cuenta de Google o Apps Script, no hay quién avise (por eso Estado muestra cuándo fue el último chequeo).
- Que los datos estén bien: sabe que las fechas de examen se leyeron hace poco, no si el SIU las publicó correctas.

## Cambiar algo después

- **Cambiar el código o el diseño del mail:** se cambia `apps-script/Code.gs` en el repo (con PR) y después se vuelve a pegar en el editor de Apps Script y se guarda. No hace falta tocar nada más: el activador sigue andando con el código nuevo.
- **Ver el diseño sin mandar nada:** abrí `apps-script/preview.html` en el navegador (el mail con datos de ejemplo). Si cambiás el mail en `Code.gs`, regeneralo con `node tools/reminders/apps-script/preview.mjs` (las pruebas avisan si quedó viejo).
- **Cambiar el token:** en Propiedades del script borrá `TOKEN`, corré `createToken` y pegá la línea nueva en el SQL Editor. Si está la aplicación web, cambialo también en Vercel (`AVISOS_WEBAPP_TOKEN`).
- **Frenar todo:** en **Activadores**, borrá el de `hourly` (frena también el monitor).

## Privacidad

La planilla tiene mails de alumnos (también el otro mail que algunos eligen): no la compartas con nadie más. El registro de ejecuciones muestra solo cantidades. La política de privacidad (`src/app/privacidad/page.tsx`) dice que los datos de los recordatorios se copian a esta planilla y que los mails salen de esta cuenta.
