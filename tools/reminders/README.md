# Recordatorios de finales ("Recordarme")

En Finales, el alumno toca **Recordarme**, tilda las mesas que quiere y toca **Aceptar**. Se guardan en `exam_reminders` (migración `20261113150000_exam_reminders.sql`). Por cada mesa le llegan dos mails a su cuenta @fi.uba.ar: cuando abre la inscripción y el último día.

Los mails salen de la cuenta de Google del proyecto, **avisosfiubi@gmail.com**, con un Apps Script pegado en una planilla de esa cuenta. No depende de GitHub Actions.

## Cómo funciona

Una vez por hora, el script (`apps-script/Code.gs`, función `hourly`):

1. Le pregunta a la base qué recordatorios hay y qué mail toca ahora (`avisos_pendientes()`, migración `20261114120000_avisos_rpc.sql`). La base vuelve a leer cada mesa en `exam_tables` por materia, nombre, tipo y fecha (la sincronización diaria del SIU cambia los ids): si el SIU movió la inscripción, usa las fechas nuevas. De paso borra los recordatorios de exámenes que ya pasaron.
2. Desde las 8 de la mañana manda los mails que tocan y, después de **cada** mail, lo marca en la base (`avisos_marcar_enviado()`). La base no lo vuelve a ofrecer nunca, aunque alguien toque la planilla.
3. Reescribe la pestaña **Recordatorios** de la planilla con todos los recordatorios: es solo una copia para mirar. Editarla no cambia nada.

Reglas (están en la base, con pruebas en `tools/db-test/security.sql`):

- **Mail de apertura:** una vez abierta la inscripción, desde las 8 del primer día. Si el alumno lo pidió con la inscripción ya abierta, o el SIU no da fecha de apertura, no va.
- **Mail del último día:** desde las 8 del último día, mientras siga abierta. Si la inscripción cierra a las 00:00 o a la mañana, el último día es el anterior. Si el de apertura no salió hasta ese día, va solo este.
- Nunca antes de las 8, nunca con la inscripción cerrada, nunca dos veces. Solo a cuentas @fi.uba.ar y a mesas del plan actual del alumno.

**Límite de Gmail:** una cuenta gratuita manda unos 100 mails por día. Si en un día tocan más, el script para y manda el resto en las horas siguientes o al otro día (mientras la inscripción siga abierta).

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
   - Te llegan a avisosfiubi@gmail.com dos mails de prueba ("[Prueba] Abrió la inscripción…" y "[Prueba] Hoy es el último día…"). No toca la base ni la planilla. El logo se ve recién cuando el PR esté integrado (sale de fiubi.com.ar).
5. **Crear el token.** Elegí `createToken` y tocá **Ejecutar**. En el **Registro de ejecución** de abajo aparece una línea que empieza con `insert into public.avisos_config`. Copiala entera.
6. **Guardar el token en la base** (desde acá, con el PR ya integrado). En [Supabase](https://supabase.com/dashboard) → proyecto de FIUBI → **SQL Editor** → pegá la línea → **Run**. Tiene que decir "Success". (La línea tiene solo el hash del token, no el token.) Esto se hace después de que el PR esté integrado: antes la tabla no existe.
7. **Cargar la clave pública.** En Apps Script → **Configuración del proyecto** → **Propiedades de la secuencia de comandos** (en inglés, *Script Properties*) → **Agregar propiedad**:
   - Propiedad `SUPABASE_KEY`, valor: la clave pública de la app, la que empieza con `sb_publishable_`. Está en el `.env.local` (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), en Vercel → Settings → Environment Variables, o en Supabase → Project Settings → API Keys ("Publishable key"). No es secreta: es la misma que usa la web.
   - `TOKEN` ya está (lo creó el paso 5). No hace falta `SUPABASE_URL`: el script ya sabe la dirección del proyecto (`https://solnlrkmkncsntyptjjm.supabase.co`).
   - Guardá las propiedades.
8. **Probar la planilla.** Elegí `syncSheet` y tocá **Ejecutar**. En la planilla aparece la pestaña **Recordatorios** con los recordatorios que haya, sin mandar ningún mail. Si da error, el registro dice qué falta (por ejemplo, "¿TOKEN o SUPABASE_KEY mal copiados?").
9. **Prender el reloj.** Elegí `installTriggers` y tocá **Ejecutar**. Desde ahí, `hourly` corre sola una vez por hora (se ve en el ícono del reloj, **Activadores**). Correrla dos veces no la duplica.

Listo. Para ver qué pasó en cada corrida: Apps Script → **Ejecuciones** (a la izquierda). Si una falla, Google te manda un mail.

## Cambiar algo después

- **Cambiar el código o el diseño del mail:** se cambia `apps-script/Code.gs` en el repo (con PR) y después se vuelve a pegar en el editor de Apps Script y se guarda. No hace falta tocar nada más: el activador sigue andando con el código nuevo.
- **Ver el diseño sin mandar nada:** abrí `apps-script/preview.html` en el navegador (los dos mails con datos de ejemplo). Si cambiás el mail en `Code.gs`, regeneralo con `node tools/reminders/apps-script/preview.mjs` (las pruebas avisan si quedó viejo).
- **Cambiar el token:** en Propiedades del script borrá `TOKEN`, corré `createToken` y pegá la línea nueva en el SQL Editor.
- **Frenar todo:** en **Activadores**, borrá el de `hourly`.

## Privacidad

La planilla tiene mails de alumnos: no la compartas con nadie más. El registro de ejecuciones muestra solo cantidades. La política de privacidad (`src/app/privacidad/page.tsx`) dice que los datos de los recordatorios se copian a esta planilla y que los mails salen de esta cuenta.
