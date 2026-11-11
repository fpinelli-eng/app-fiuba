# Fechas de examen del SIU, todos los días

El workflow **"Fechas de examen del SIU"** (`.github/workflows/exams.yml`) copia todas las mañanas (06:00 en Buenos Aires) las mesas de examen de cada plan desde la página pública "Fechas de examen" del SIU (`guaraniautogestion.fi.uba.ar/g3w/fecha_examen`, no pide sesión) a `exam_tables`, la tabla que muestra Finales. Hace lo mismo que **Publicar fechas** en Administración → Exámenes con el enlace del SIU, pero para todos los planes y solo cuando algo cambió.

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

Cada respuesta es un JSON con `_ID_` y `nombre` de cada opción. Para sumar un plan, agregalo al archivo con esos datos (las pruebas exigen que estén todos los planes vigentes de la app y solo ellos).

Notas de la carga del 11 de noviembre de 2026:

- El SIU llama "Ingeniería de Alimentos" a Alimentos y tiene dos Agrimensuras: se usa "Ingeniería en Agrimensura" (la que tiene el plan 2023; "Agrimensura" solo tiene el 1986).
- **Lic. en Análisis de Sistemas:** el SIU tiene los planes "1986" (4 materias con mesas) y "86V14" (23 materias). Los códigos del plan 1986 de la app coinciden con el "1986" del SIU, que es el que se usa; los de "86V14" coinciden con el plan 2014 de FIUBA Map (`data/planes/sistemas-2014.json`), que la app todavía no tiene. Es un dato para la decisión abierta sobre el plan de Sistemas (`PRODUCTO.md`, sección 13).
