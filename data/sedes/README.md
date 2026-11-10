# Sedes por materia

El SIU publica algunas clases sin sede ("Aula a determinar"). Sin sede, el Plan no puede avisar de un traslado apurado entre sedes. Estos datos completan esas sedes. `src/lib/campus/infer.ts` las usa al leer la oferta, en el Plan, el calendario del Inicio y las fichas de Reseñas. En la base no se cambia nada: `offering_blocks.campus` sigue siendo lo que dijo el SIU.

## Archivos

- `materias.json`: la tabla de sedes por materia que circula todos los años entre los estudiantes (exportada de Google Sheets, sin fecha). Tiene 562 materias, todas con **códigos de los planes viejos** (6103, 91.28…), ninguna del plan 2023/2024. Cada fila trae código, nombre y `campus` (`PC`, `LH`, `CU`, o `both` si se dicta en las dos sedes). Cuando la sede depende del curso, trae `byTeacher` (apellidos del docente → sede) y `otherwise`. El porcentaje de presencialidad que traía la tabla **no se guarda**: cambia mucho más que la sede.
- `equivalencias.json`: las tablas oficiales de equivalencias plan viejo → plan 2023/2024 de cada carrera, copiadas de su resolución del Consejo Superior. Las claves son el id del plan nuevo y, dentro, el nombre de la materia nueva con los códigos viejos equivalentes. En cada plan está la resolución de donde salió.

## Cómo se elige la sede de una clase

Decidido con Francisco el 10 de noviembre de 2026, después de revisar el cruce contra las ofertas del 2C 2026:

1. **Si el SIU da la sede, se usa esa.** Nada la pisa. Tampoco se completan las clases virtuales ni las asincrónicas.
2. **Materia de un plan viejo** (código de 4 cifras): la tabla, por código exacto.
3. **Materia del plan 2023/2024:** la sede de sus equivalentes viejas, según `equivalencias.json` para el plan de la oferta.
4. **Sin equivalencia:** una materia de la tabla con nombre casi idéntico (similitud de 90 % o más, sin tildes ni palabras como "de" o "la").
5. **Queda sin sede** si las equivalentes están en sedes distintas, si la equivalencia y el nombre no coinciden, o si la tabla dice "las dos sedes".

Con las ofertas del 2C 2026 del repo, completa 45 de 59 horarios sin sede en Industrial, 11 de 15 en Informática, 66 de 80 en Química y 18 de 53 en Civil (Civil todavía no tiene equivalencias). Aplicada a los horarios que sí tienen sede, coincide con el SIU en el 98 % de los casos. Las pruebas de `src/lib/campus/infer.test.ts` controlan esos números.

## Para sumar una carrera

**Cada vez que se cargue el plan de estudios de una carrera nueva, hay que sumar también su tabla de equivalencias.** Sin ella, las materias del plan nuevo solo se cruzan por nombre, que completa muchas menos sedes.

- La resolución de cada plan 2023/2024 se baja de https://www.fi.uba.ar/institucional/plan2020/planes-de-estudio-2023 (el PDF "RESCS…" de la carrera). La tabla de equivalencias está al final, en "Transición entre planes".
- Si el plan tuvo una modificación posterior (Industrial: RESCS 2024-63), usar la más nueva.
- Se copia a `equivalencias.json` con el id del plan nuevo (`civil-2023`), anotando la resolución en `source`. Después se suma su oferta a las pruebas de `infer.test.ts`.

**Claude:** si alguien pide cargar o sumar el plan de estudios de otra carrera y no adjunta su resolución, pedísela antes de terminar.

Cuando llegue la tabla de sedes de un año nuevo, se reemplaza `materias.json` con el mismo formato y se vuelven a correr las pruebas.
