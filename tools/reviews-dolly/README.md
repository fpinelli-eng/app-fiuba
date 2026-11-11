# Reseñas históricas de Dolly

[Dolly FIUBA](https://github.com/lugfi/dolly), de LUGFi, fue la app de opiniones de la facultad durante más de diez años. Su base es pública (`gente.txt`, licencia GPL-3.0): unas 13.000 encuestas sobre docentes, de 2015 a 2024. La app las mezcla con las reseñas propias al leer (las dos tablas siguen separadas): suman al puntaje del curso (buscador de Reseñas, ficha y Plan, con `course_star_counts()`) y aparecen en los comentarios de la ficha con "vía Dolly" y el docente encuestado. No cuentan para las reseñas pendientes ni aparecen en Administración → Reseñas. La lógica de la mezcla está en `src/lib/reviews/merge.ts`.

## Qué se carga

- Encuestas desde 2019 (se cambia al correr el workflow).
- Solo de las materias viejas que figuran en `mapping.json`, la tabla de materias viejas (códigos de 4 cifras, como 6201) a materias del plan 2023. Cada equivalencia dice de dónde sale (`source`) y qué tan segura es (`confidence`).
- Solo si el docente encuestado es docente de **un único** curso del cuatrimestre actual de esa materia: se buscan todas las palabras de su nombre en el nombre del SIU. Si no aparece o aparece en más de un curso, la encuesta queda afuera.
- Estrellas: el promedio de los nueve puntajes de la encuesta, redondeado.
- Comentarios: pasan por el mismo filtro que las reseñas de la app (`src/lib/reviews/filter.ts`). Si no lo pasan, se carga la encuesta sin el comentario.

## Cómo se corre

Actions → **Reseñas de Dolly** → Run workflow. Conviene correrlo después de publicar la oferta de un cuatrimestre nuevo, así las opiniones siguen a los cursos actuales. Cada vez reemplaza todas las de Dolly.

Para ver los números sin tocar la base:

```bash
node --experimental-strip-types tools/reviews-dolly/build.mjs > tools/reviews-dolly/out.sql
```

Para borrarlas todas: `delete from public.historical_reviews where source = 'dolly';`

## Licencia y crédito

Los datos de Dolly son GPL-3.0, por eso el repositorio tiene licencia GPL-3.0 (`LICENSE`). La ficha del curso da crédito a Dolly y LUGFi con un link al repositorio original, debajo de los comentarios ("Incluye opiniones históricas de Dolly FIUBA, de LUGFi."), y cada opinión lleva "vía Dolly" con el mismo link. Ese crédito no se saca.
