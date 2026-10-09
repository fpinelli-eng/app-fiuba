# Prototipos del diseño

Código fuente de cada pantalla del lienzo de Claude Design "App FIUBA — Diseño", exportado el 9 de octubre de 2026.

**Para qué sirven:** son la referencia exacta del diseño (medidas, espaciados, tamaños de letra, textos y comportamiento). Antes de programar una pantalla, leé su archivo.

**Cómo leerlos:**
- La parte visual está en el HTML, con los estilos escritos en línea.
- `{{algo}}` es un valor que calcula la lógica; `<sc-if>` muestra algo según una condición; `<sc-for>` repite un bloque por cada elemento de una lista.
- La lógica de los prototipos interactivos está al final, en `<script type="text/x-dc">`, dentro de `renderVals()`.

**Tené en cuenta:**
- No se abren directamente en el navegador: necesitan el motor de Claude Design. Para verlos funcionando, usá el lienzo (pedile el link a Francisco).
- Los datos son ficticios (Sofía Ramírez, docentes inventados, puntajes de ejemplo).
- Los colores aparecen como hexadecimales porque es un prototipo. En la app se usan **siempre** los tokens de `src/app/globals.css` (ver `docs/DISENO.md`).
- Si un prototipo contradice `PRODUCTO.md` o `docs/DISENO.md`, mandan esos documentos.

| Archivo | Pantalla | Interactivo |
|---|---|---|
| `01-ingreso.html` | Login y elección de carrera y plan | Sí |
| `02-cuenta-rechazada.html` | Ingreso con una cuenta que no es @fi.uba.ar | No |
| `03-primera-carga.html` | Mapa vacío con la carga guiada de materias | Sí |
| `04-inicio.html` | Panel de inicio, modo claro | No |
| `05-inicio-oscuro.html` | Panel de inicio, modo oscuro | No |
| `06-mapa.html` | Mapa de la carrera | Sí |
| `07-plan.html` | Plan del cuatrimestre | Sí |
| `08-plan-bloqueado.html` | Plan bloqueado por reseñas pendientes | No |
| `09-resenas-buscador.html` | Buscador de cursos y reseñas | Sí |
| `10-resenas-ficha-curso.html` | Ficha de un curso | No |
| `11-resenas-pendientes.html` | Reseñas pendientes, con el filtro de comentarios | Sí |
| `12-perfil.html` | Perfil y configuración | Sí |
| `13-administracion.html` | Administración: oferta y reseñas | Sí |
