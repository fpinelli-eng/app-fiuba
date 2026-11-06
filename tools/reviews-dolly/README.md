# Reseñas históricas de Dolly

[Dolly FIUBA](https://github.com/lugfi/dolly), de LUGFi, fue la app de opiniones de la facultad durante más de diez años. Su base es pública (`gente.txt`, licencia GPL-3.0): unas 13.000 encuestas sobre docentes, de 2015 a 2024. La app las muestra en la ficha de cada curso como "Opiniones históricas de Dolly", aparte de las reseñas propias. No suman al puntaje del curso ni cuentan para las reseñas pendientes.

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

Los datos de Dolly son GPL-3.0, por eso el repositorio tiene licencia GPL-3.0 (`LICENSE`). La ficha del curso da crédito a Dolly y LUGFi con un link al repositorio original.
