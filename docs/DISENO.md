# Diseño

El diseño completo está en el lienzo de Claude Design **"App FIUBA — Diseño"** (dueño: Francisco; se comparte desde el menú de compartir del lienzo). Las pantallas marcadas "(se puede usar)" son prototipos interactivos: conviene usarlos antes de programar cada pantalla.

Este documento resume lo necesario para programar sin tener el lienzo abierto.

El código fuente de cada pantalla está en [`docs/diseno/prototipos/`](diseno/prototipos/): es la referencia exacta de medidas, textos y comportamiento.

## Colores

Definirlos una sola vez como variables de tema. Nunca usar un hexadecimal suelto en un componente.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | #F3F2F9 | #111117 | Fondo de página |
| `surface` | #FFFFFF | #1A1A23 | Tarjetas |
| `header` | #FFFFFF | #17171F | Barra superior |
| `border` | #E2E0EE | #2A2A37 | Bordes de tarjetas |
| `border-strong` | #D4D2E3 | #363645 | Bordes de inputs y botones secundarios |
| `ink` | #24243A | #ECECF3 | Texto principal |
| `ink-2` | #3A3A52 | #CFCFDC | Texto de comentarios y docentes |
| `muted` | #5D5E76 | #A3A3B8 | Texto secundario |
| `accent` | #5B5BD6 | #A3A1FA | Botones principales, selección, foco |
| `accent-soft` | #EFEDFF | — | Fondo de una opción elegida |
| `star` | #E8B23A | #E8B23A | Estrellas |
| `danger` | #B3261E | #F2867D | Eliminar, borrar cuenta |

Pasteles (fondo / texto). En oscuro se usan versiones apagadas.

| Nombre | Claro | Oscuro | Uso |
|---|---|---|---|
| Lavanda | #E3DEFF / #2E2A6E | #2B2850 / #C9C4FF | Navegación activa, encabezado de materia, panel de electivas (#F1EEFD) |
| Menta | #D6F1E3 / #1F4D36 | #1D3A2C / #BDEBD2 | Aprobada, éxito |
| Manteca | #FFF1C7 / #5A4310 | #3A3220 / #F3DDA0 | Final pendiente, advertencias suaves |
| Celeste | #DCEBFB / #2F4F73 | — | Cursando, "Nuevo" |
| Durazno | #FFE3D3 / #8A3A18 | #3D2A20 / #FFC9A8 | Pendientes, errores de validación, contador de reseñas |

Estados del mapa:

| Estado | Fondo | Borde | Texto |
|---|---|---|---|
| Aprobada | #D6F1E3 | 1px #BFE3CF | #1F4D36 |
| Final pendiente | #FFF1C7 | 1px #F0DC9C | #5A4310 |
| Cursando | #DCEBFB | 1px #BCD6F2 | #2F4F73 |
| Habilitada | #FFFFFF | 1.5px #8F8DAE | #24243A |
| Bloqueada | #EEEDF3 | 1px punteado #B9B7CC | #5F5F75 |

Cada materia del calendario recibe un color pastel distinto, asignado en orden de una paleta fija para que nunca se repitan, y lo mantiene en toda la app.

## Tipografía y forma

- IBM Plex Sans (400, 500, 600, 700). Nada de tipografías monoespaciadas.
- Números con `tabular-nums lining-nums`.
- Títulos de página 30–32 px / 600. Títulos de tarjeta 19 px / 600. Texto 15 px. Secundario 13–14 px.
- Etiquetas de sección en mayúsculas: 11–12 px, 600, espaciado 0,08 em, color `muted`.
- Radios: tarjetas 16–18 px, botones e inputs 10–12 px, chips 999 px.
- Botón principal: fondo `accent`, texto blanco, 40–46 px de alto. Secundario: fondo `surface`, borde `border-strong`. Deshabilitado: fondo #ECEBF4, texto #8A8AA0, cursor `not-allowed`.
- Barra superior de 68 px: logo + nombre a la izquierda; navegación Inicio · Mapa · Plan · Reseñas al centro (la activa con fondo lavanda); a la derecha, botón de modo oscuro y avatar.

## Pantallas

### Ingreso
- Pantalla 1: mosaico decorativo de bloques pastel, nombre de la app en grande (88 px, 700), "Tu carrera de FIUBA en un solo lugar" y el botón "Ingresar con tu cuenta @fi.uba.ar". Nada más.
- Cuenta rechazada: debajo del botón, recuadro durazno con "<mail> no es una cuenta de FIUBA" + "Ingresá con tu mail @fi.uba.ar"; el botón pasa a "Probar con otra cuenta".
- Pantalla 2: "¿Qué carrera estudiás?", las 13 carreras en grilla de dos columnas y, si la carrera tiene más de un plan, los planes (el vigente marcado y con la etiqueta "Vigente"; los viejos de carreras que cambiaron de nombre muestran el nombre anterior). "Continuar" lleva al mapa en modo de primera carga.

### Primera carga de materias
- Es el mapa vacío con el título "Cargá tus materias" y un botón "Listo" que lleva al inicio.
- La ficha arranca abierta en la primera materia del CBC. Muestra notas 4–10 ("Aprobada con") y los botones Final pend. / Cursando / Sin cursar. Elegir cualquiera guarda y pasa **sola** a la materia siguiente (CBC y después columna por columna). "← Anterior" y "Siguiente →" para moverse sin cambiar nada.
- La prueba de inglés solo tiene Aprobada / Pendiente. Las electivas se cargan desde su panel, sin avance automático.

### Inicio
- Saludo, aviso de reseñas pendientes cuando las hay, avance (porcentaje y barra dividida CBC / obligatorias, créditos por categoría), promedio, cuadro "Materias" (aprobadas incluyendo CBC y estado de la prueba de inglés), calendario semanal de la cursada actual y "Finales pendientes" con lo que destraba cada uno.

### Mapa de la carrera
- Columnas CBC + 1.º a 8.º cuatrimestre, sin flechas. Nodo de 112 × 92 px: nombre (hasta 3 líneas), ícono de estado, nota en 16 px / 700 si está aprobada, créditos "8 C" chiquitos.
- Clic en una materia: ficha flotante con Necesita / Habilita / Tu estado / Nota. Las que necesita se marcan con contorno sólido; las que habilita, con contorno punteado; el resto baja a 30 % de opacidad.
- "Aprobada" sin nota no se guarda: abre el selector de nota primero.
- CBC compactable en una columna angosta; compactado por defecto cuando está completo.
- Panel de electivas a la derecha (276 px, fondo #F1EEFD) agrupado por área, con filtros Todas / Habilitadas / Bloqueadas y barra de créditos de electivas.
- Buscador de materias que atenúa las que no coinciden.

### Plan del cuatrimestre
- Columna izquierda (390 px) con materias habilitadas y sus cursos. Por curso: "Curso N" en negrita (+ chip "En tu plan"), debajo hasta 3 apellidos de docentes (sin "Prof.") y "+N" si hay más, horario y sede, estrellas y botón Agregar / Cambiar / Quitar.
- Encabezado de materia con un círculo que se rellena con el color de la materia cuando está en el plan.
- Pasar el mouse por un curso muestra una vista previa en el calendario.
- Calendario Lun–Sáb de 7 a 23 h. Bloques con materia, curso, sede y horario.
- Avisos: superposición (coral) y traslado apurado (menos de 1 h entre clases en sedes distintas).
- Clases asincrónicas fuera de la grilla, en una franja "ASINCRÓNICAS" debajo, sin avisos.
- Pestañas "Opción A / Opción B" y "Vaciar plan".
- **Bloqueado** si hay reseñas pendientes: tarjeta con candado, "Reseñá tu cursada para armar el plan del <cuatrimestre>", la lista de cursos pendientes y "Completar reseñas".

### Reseñas
- **Buscador:** lista plana con todas las materias del plan (CBC excluido), tengan reseñas o no. Encabezado de materia con fondo lavanda; cursos debajo en filas blancas ("Curso N" + docentes + puntaje). Busca por materia o docente, sin importar los acentos. Ordenar por mejor puntaje o más reseñas. "Sin reseñas todavía" y "No se dicta este cuatrimestre" cuando corresponde.
- **Ficha de curso:** "Curso N" como título, docentes debajo, puntaje grande con distribución de estrellas, otros cursos de la materia y comentarios (más recientes primero; las fijadas arriba con la etiqueta "Destacada"). Sin botón de reportar.
- **Reseñas pendientes:** una tarjeta por curso con estrellas (al pasar el mouse: Muy malo / Malo / Regular / Bueno / Excelente), "+ Agregar un comentario" (hasta 500 caracteres) y "Enviar reseña", deshabilitado hasta elegir estrellas. Barra de progreso "N de 3" y, al completar todas, un aviso verde con "Ir al plan".
- **Filtro al escribir:** si el comentario tiene insultos, teléfonos, mails, links o @usuarios, aparece un aviso en durazno debajo del campo y no se puede enviar.

### Perfil y configuración
- Avatar grande con botón de cámara para subir foto ("Quitar foto" cuando hay una); nombre, mail, "Cerrar sesión".
- Carrera: "Ing. Industrial · Plan 2023" + "Cambiar" (selectores de carrera y plan; aviso de que las materias pasan por equivalencias).
- Apariencia: Claro / Oscuro / Según el sistema.
- Mis reseñas: lista con estrellas y comentario, "Editar" en el lugar, acceso a las pendientes y "Se publican sin tu nombre."
- Tus datos: "Descargar mis datos" y "Borrar mi cuenta" con confirmación ("…Tus reseñas siguen publicadas, sin tu nombre. No se puede deshacer.").
- Pie: "Hecho por estudiantes. No es un sitio oficial de la universidad."

### Administración
- Pestañas "Oferta del cuatrimestre" y "Reseñas". Solo para administradores.
- **Oferta:** lista de los 24 planes con un punto de estado (sin cargar / procesado / publicado) y el progreso "N de 24 planes publicados". Fecha de reseñas pendientes arriba.
  - Sin cargar: campo para pegar el texto del SIU + "Procesar".
  - Procesado: resumen (materias, cursos, horarios), "Cursos con cambios" con tres opciones por curso (mismo curso que uno anterior / curso nuevo / no mostrar) y la sugerida ya marcada, "Materias que no están en el plan" y "Publicar" siempre habilitado.
  - Publicado: oferta por materia con buscador; cada curso con "Quitar" / "Volver a mostrar"; "Reemplazar con otro texto".
- **Reseñas:** todas, con buscador (materia, docente o texto) y filtro Todas / Fijadas. Cada una con "Fijar" y "Eliminar" (con deshacer).
