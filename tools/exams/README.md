# Fechas de examen del SIU, todos los días

El workflow **"Fechas de examen del SIU"** (`.github/workflows/exams.yml`) copia todas las mañanas (06:13 en Buenos Aires, y de nuevo a las 12:13 por si GitHub salteó la primera) las mesas de examen de cada plan desde la página pública "Fechas de examen" del SIU (`guaraniautogestion.fi.uba.ar/g3w/fecha_examen`, no pide sesión) a `exam_tables`, la tabla que muestra Finales. Hace lo mismo que **Publicar fechas** en Administración → Exámenes con el enlace del SIU, pero para todos los planes y solo cuando algo cambió.

## Cómo funciona

1. `current.sql` lee las mesas que hay hoy en la base (un JSON).
2. `sync.mjs` baja, de a una y con pausas, la búsqueda de cada plan de `data/siu/exam-filters.json`, la lee con el mismo intérprete de la app (`parseSiuExamsHtml()`, `src/lib/siu/exams-html.ts`) y la compara con la base (`src/lib/exams/siu-sync.ts`, con pruebas).
3. Si un plan cambió, `apply.sql` reemplaza todas sus mesas en una sola transacción y anota la carga en `exam_imports`. Los planes sin cambios no se tocan: correrlo dos veces da lo mismo.

Un plan **se saltea y conserva sus fechas** si el SIU no responde, devuelve cero mesas (una página de error o sin fechas publicadas nunca borra un plan) o muestra otra carrera u otro plan que el pedido. Si no se pudo leer **ningún** plan, el workflow falla y GitHub le manda un mail al dueño del repo: probablemente el SIU está caído o cambió su página.

En el resumen de cada corrida (Actions → la corrida → Summary) hay una línea por plan: cuántas mesas tiene y cuántas son nuevas, se quitaron o cambiaron (hora, aula, inscripción, docentes). El repo es público: el log y el resumen muestran solo cantidades, nunca nombres.

Ojo: si un administrador publica fechas a mano, a la mañana siguiente el workflow las reemplaza por las del SIU (si el SIU devuelve mesas para ese plan).

## Correrlo

- **Desde GitHub:** Actions → Fechas de examen del SIU → Run workflow. Con "Solo leer el SIU" tildado hace una prueba: baja y lee todo, muestra las cantidades y no se conecta a la base.
- **En tu computadora (prueba, no toca la base):**

  ```
  node --experimental-strip-types tools/exams/sync.mjs
  node --experimental-strip-types tools/exams/sync.mjs --only industrial-2023,quimica-2023
  ```

  Con `--current mesas.json --sql cambios.sql` compara con un JSON de `current.sql` y escribe el SQL para `psql -f cambios.sql`. Necesita Node 22.15 o más nuevo (`ts-resolve.mjs` deja cargar los módulos de `src/` sin extensión).

Necesita el secreto `SUPABASE_DB_PASSWORD` (el mismo de "Base de datos") y se conecta igual que los otros workflows (*session pooler* IPv4).

## `data/siu/exam-filters.json`

Para cada plan de la app, los filtros del SIU: carrera (`career`) y plan (`plan`), cada uno con su id (el `_ID_` de las opciones del SIU) y el nombre que el SIU muestra, que se usa para comprobar que la página devuelta es la pedida. `ra` y `ubicacion` son la única opción de la FIUBA ("Sede Única").

Los ids salen de los mismos pedidos que hace la página al elegir en los filtros (no piden sesión):

```
https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen/buscar_carreras?ra=<ra>&ubicacion=<ubicacion>
https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen/buscar_planes?carrera=<id de la carrera>
```

Cada respuesta es un JSON con `_ID_` y `nombre` de cada opción. Para sumar un plan, agregalo al archivo con esos datos (las pruebas exigen que estén todos los planes vigentes y que cada `planId` sea un plan de la app). Un plan puede aparecer más de una vez, con otra búsqueda del SIU: sus mesas son la unión de todas (una mesa que aparece en las dos se guarda una vez; una búsqueda vacía no importa si otra trae mesas, pero si una falla o muestra otra carrera, el plan se saltea).

Notas de la carga del 11 de noviembre de 2026:

- El SIU llama "Ingeniería de Alimentos" a Alimentos y tiene dos Agrimensuras: se usa "Ingeniería en Agrimensura" (la que tiene el plan 2023; "Agrimensura" solo tiene el 1986).
- **Lic. en Análisis de Sistemas:** el SIU tiene los planes "1986" (sistemas-1986) y "86V14" (sistemas-2014: "Plan 1986 modificado en 2014", con los mismos códigos).
- **Planes anteriores** (sumados el 11 de noviembre; mesas leídas ese día en la prueba): civil-2009 → Civil "2009" (94), electronica-2009 → Electrónica "2009" (271), agrimensura-2006 → Ingeniería en Agrimensura "1986" (9; es el único plan viejo de Agrimensura en el SIU, con los códigos del 2006 de FIUBA Map; la carrera "Agrimensura" del SIU tiene un "1986" con un subconjunto de esas mesas y no se usa), alimentos-2001 → Alimentos "2001" (38), energia-electrica-2009 → Ingeniería Electricista "2009" (142), informatica-1986 → Informática "1986" (116; los planes "INF - Sistemas Distribuidos", "INF - SISTEMAS DE PRODUCCION" e "INF - Gestión Industrial de Sistemas" devuelven las mismas mesas y no se usan), petroleo-2015 → Petróleo "2015" (23), industrial-2011 → Industrial "2011" (145), mecanica-1986 → Mecánica "1986" + "1986M" (251 juntas), naval-1986 → Ingeniería Naval y Mecánica "1986N" (162; el "1986" de Ingeniería Naval trae un subconjunto), quimica-1986 → Química "1986" + "1986M" (71 juntas), sistemas-1986 → "1986" (25), sistemas-2014 → "86V14" (130).
- Todos los planes de la app tienen búsqueda en el SIU. Del SIU quedan sin usar los "1986" de las carreras que en la app no tienen ese plan (Civil, Electrónica, Electricista, Industrial; FIUBA Map no los tiene).
