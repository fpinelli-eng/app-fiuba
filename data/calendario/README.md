# Calendario académico

Fechas del calendario académico de la FIUBA que se muestran en **Novedades** (`/novedades`). Solo el bloque **ESTUDIANTES** del PDF.

- `2026-2027.json`: sacado de `Calendario_Academico_2026_2027.pdf` (lo publica la FIUBA en www.ingenieria.uba.ar). Una entrada por cada tramo de semanas seguidas: `title`, `starts_on` (lunes de la primera semana), `ends_on` (sábado de la última) y `sort` (fila del PDF, de arriba hacia abajo).
- Se cargó en la base con `supabase/migrations/20261102150000_news.sql` (tabla `academic_events`, `calendar = '2026-2027'`). La app muestra solo el calendario más nuevo (el nombre más grande).
- Son semanas y tentativas (el PDF se arma a principio de año). Novedades muestra solo las filas importantes (`isImportantDate()` en `src/lib/news/model.ts`: si el PDF nuevo cambia un título, actualizalo ahí también) como "Tentativa", hasta que un administrador confirma la fecha real desde Administración → Novedades (`academic_date_confirmations`). Si se vuelve a cargar un calendario con una migración, sus filas cambian de id y las confirmaciones quedan como fechas sueltas: revisalas.
- Revisado el 13/11/2026 contra el PDF que enlaza https://www.fi.uba.ar/estudiantes/calendario-academico (el mismo archivo, `Calendario_Academico_2026_2027_81c0faa452_909e52c493.pdf`, modificado el 17/12/2025): las 70 fechas coinciden, semana por semana. Ojo: el PDF marca **semanas** ("las fechas indicadas corresponden a los días lunes de cada semana"), no días; las fechas exactas las anuncia la Secretaría por mail. `src/lib/news/calendar-data.test.ts` fija algunas filas y comprueba que la migración cargó exactamente este JSON.
- **Si la FIUBA cambia el PDF**, el monitor de la planilla de avisos manda un mail ("El calendario académico de la FIUBA cambió", `tools/reminders/README.md`, "Monitor"). Entonces se baja el nuevo y se siguen los pasos de abajo.

## Cómo cargar el del año que viene

El PDF es un dibujo (no tiene texto): una tabla con una fila por actividad y una columna por semana, con las semanas marcadas en celeste. `tools/calendar/extract.py` lee la grilla y las celdas pintadas.

1. Bajá el PDF nuevo y abrilo. Fijate:
   - el **lunes de la primera columna** (en 2026-2027 era el 5 de enero de 2026);
   - que las filas de ESTUDIANTES sean las mismas. Si cambiaron, actualizá la lista `TITLES` de `tools/calendar/extract.py` (de arriba hacia abajo). El script avisa si la cantidad de filas no coincide.
2. Corré el script (necesita Python con PyMuPDF: `pip install pymupdf`), desde una carpeta cualquiera:

   ```
   cd "$TEMP" && python -E <repo>/tools/calendar/extract.py <ruta al PDF> 2027-01-04 <repo>/data/calendario/2027-2028.json
   ```

   Muestra cuántas filas y columnas encontró (tienen que ser todas las semanas del PDF).
3. **Revisá el resultado contra el PDF**, por lo menos 5 o 6 filas (por ejemplo Período de Clases, Inscripción para Cursar Asignaturas, Evaluaciones Integradoras, Charla de Ingresantes). Si algo no coincide, se arregla el script, no el JSON a mano.
4. Generá la migración con una fecha posterior a la última:

   ```
   node tools/calendar/build.mjs 2027-2028 > supabase/migrations/<AAAAMMDDHHMMSS>_academic_calendar_2027_2028.sql
   ```

   Borra las fechas de ese mismo calendario antes de insertarlas, así que si hubo un error se puede corregir con otra migración igual.
5. Pull request como siempre. Al integrarse a `main`, la migración se aplica sola y Novedades pasa a mostrar el calendario nuevo.
