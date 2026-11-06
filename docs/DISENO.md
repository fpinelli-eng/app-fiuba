# Diseño

El diseño completo está en el lienzo de Claude Design **"App FIUBA — Diseño"** (dueño: Francisco; se comparte desde el menú de compartir del lienzo). Las pantallas marcadas "(se puede usar)" son prototipos interactivos: conviene usarlos antes de programar cada pantalla.

Este documento resume lo necesario para programar sin tener el lienzo abierto.

El código fuente de cada pantalla está en [`docs/diseno/prototipos/`](diseno/prototipos/): es la referencia exacta de medidas, textos y comportamiento.

## Colores

**Rediseño del 5 de noviembre de 2026.** La paleta lavanda original se reemplazó por una paleta pastel media y coherente (amarillo, azul, coral, verde) sobre un fondo gris azulado muy claro; en oscuro, azul noche (nunca negro). Los nombres de los tokens no cambiaron, solo sus valores: así el cambio llegó a todas las pantallas desde `globals.css`. Referencia visual: lienzo de Claude Design "App FIUBA · Direcciones visuales" (tableros "Inicio ajustado" y "Inicio · oscuro y celular"). Contraste AA verificado en claro y oscuro.

Definirlos una sola vez como variables de tema. Nunca usar un hexadecimal suelto en un componente.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | #F6F7FA | #12151F | Fondo de página |
| `surface` | #FFFFFF | #1B1F2C | Tarjetas, barra de pestañas del celular |
| `header` | #F6F7FA | #12151F | Barra superior (igual al fondo: el menú queda sobre la página) |
| `line` | #E6E9F0 | #2A3040 | Bordes de tarjetas |
| `line-strong` | #C9CFDB | #3A4152 | Bordes de inputs y botones secundarios |
| `ink` | #1F2537 | #ECEEF5 | Texto principal |
| `ink-2` | #3B4357 | #C9CEDB | Texto de comentarios y docentes |
| `muted` | #5E667A | #A3A9BA | Texto secundario |
| `accent` | #3B5BD0 | #9DB4F7 | Botones principales, links, selección, foco, punto del menú |
| `accent-soft` | #E4ECFC | #22304F | Fondo de una opción elegida |
| `star` | #E8B23A | #E8B23A | Estrellas |
| `danger` | #B3261E | #F2867D | Eliminar, borrar cuenta |

Pasteles (fondo / texto). En oscuro, tintes apagados del mismo tono.

| Nombre (token) | Claro | Oscuro | Uso |
|---|---|---|---|
| Celeste UI (`lavender`) | #E4ECFC / #22408F | #22304F / #C9D6FB | Navegación activa del celular, encabezado de materia, materias aprobadas del Inicio; panel de electivas `lavender-panel` #EEF2FB |
| Verde (`mint`) | #DFF2E9 / #245C48 | #1D3A2F / #BFE6D3 | Aprobada, éxito, promedio del Inicio |
| Amarillo (`butter`) | #FFF0D3 / #5C4510 | #3A3220 / #F3DDA0 | Final pendiente, advertencias suaves |
| Celeste estado (`sky`) | #DDEEFA / #1F4F72 | #1C3346 / #B9DCF5 | Cursando, "Nuevo" |
| Coral (`peach`) | #FCEBE7 / #7A2A1E | #3D2622 / #F6C1B6 | Pendientes, errores de validación, contador de reseñas |
| Rosa (`pink`) | #F9E3EE / #6E2348 | #3D2333 / #F5C3DB | Solo calendario del plan (6.ª materia) |
| Verde agua (`teal`) | #DDF0EC / #1E5450 | #1B3634 / #B2E6E1 | Solo calendario del plan (7.ª materia) |

Categorías del arco de avance del Inicio (tokens `cat-*`): CBC #F0B54A (oscuro #F3C46A), obligatorias #5B7FE3 (#7E9BF0), electivas #EE8B7B (#F2A193), trabajo final #67B39A (#86C9B1); el tramo sin hacer, `arc-track` #E6E9F0 (#2A3040). El arco no depende solo del color: la leyenda repite cada categoría con sus créditos.

Estados del mapa: mismos tokens (`mint`, `butter`, `sky` con sus `*-line`; habilitada con borde `enabled-line` #8F96AD; bloqueada `blocked` #EEF0F4, borde punteado `blocked-line` #B9BFCC, texto `blocked-ink` #5F6578).

Cada materia del calendario recibe un color pastel distinto, asignado en orden de una paleta fija para que nunca se repitan, y lo mantiene en toda la app.

## Marca

- **Nombre:** FIUBI (decidido el 6 de noviembre de 2026). En el código, `APP_NAME` de `src/lib/app.ts`.
- **Logo:** "FIUBI" en Unbounded 600, con la U dibujada como el arco de avance del Inicio: tramo izquierdo amarillo, curva azul y tramo derecho coral. Tokens `brand-u1`, `brand-u2` y `brand-u3`: en claro, los tonos intensos #E59E1F / #3F63D6 / #E2654F, para que la U se lea sobre el fondo; en oscuro, los mismos del arco (#F3C46A / #7E9BF0 / #F2A193). Componente `src/components/Logo.tsx`: el alto se pone con una clase `h-…` y el ancho sale solo.
- **Ícono:** la columna dórica de la entrada de Paseo Colón (fuste acanalado, capitel y dos escalones), en crema #FBF6EC sobre azul noche #1F2537. Archivos: `src/app/icon.svg` (pestaña), `src/app/apple-icon.png` (iPhone) y `public/icons/` (Android, por `src/app/manifest.ts`). El dibujo y las versiones descartadas están en el lienzo de diseño, página "Logo FIUBI".
- No es el logo de la facultad: la columna es parte del edificio. Se mantiene la aclaración "no es oficial".

## Tipografía y forma

- **Onest** (variable) para todo el texto y **Unbounded** (variable) para títulos de página (`h1`, regla global) y números grandes (clase `font-display`). Las dos servidas desde el proyecto (`@fontsource-variable/onest`, `@fontsource-variable/unbounded`). Nada de tipografías monoespaciadas.
- Números con `tabular-nums lining-nums`.
- Títulos de página 30–32 px / 600. Títulos de tarjeta 19 px / 600. Texto 15 px. Secundario 13–14 px.
- Etiquetas de sección en mayúsculas: 11–12 px, 600, espaciado 0,08 em, color `muted` (se revisan pantalla por pantalla en el rediseño).
- Radios: tarjetas 16–18 px, botones e inputs 10–12 px, chips 999 px. En las pantallas rediseñadas, bloques de 24–32 px.
- Botón principal: fondo `accent`, texto blanco, 40–46 px de alto. Secundario: fondo `surface`, borde `border-strong`. Deshabilitado: fondo `disabled`, texto `disabled-ink`, cursor `not-allowed`.
- Barra superior de 72 px sobre el fondo de la página, sin borde: el logo FIUBI a la izquierda (`src/components/Logo.tsx`); al centro Inicio · Mapa · Plan · Reseñas · Finales · Novedades como texto, la activa en `ink` con un punto `accent` debajo; a la derecha, botón de modo oscuro y avatar.

## Celular (agregado el 2 de noviembre, no está en el prototipo)

- Desde 768 px todo se ve como en la computadora. Debajo, el diseño se adapta en lugar de achicarse.
- Barra superior compacta (56 px): logo y nombre, Novedades como ícono de campana y el avatar (lleva al perfil). Sin botón de tema: se cambia en Perfil → Apariencia.
- Barra de pestañas fija abajo, como en una app: Inicio, Mapa, Plan, Reseñas y Finales, con ícono y nombre corto; la activa con el ícono sobre fondo lavanda y el contador de reseñas pendientes en durazno sobre el ícono. Respeta la zona segura del iPhone.
- Márgenes de 16 px, títulos de 26–28 px, tarjetas de a una, los cuatro números del avance en 2 × 2.
- Calendario de la cursada del inicio: un día por vez con botones Lun–Sáb (punto si hay clases, hoy con borde) y la lista de clases del día con horario, curso y sede. Arranca en hoy o, si hoy no hay clases, en el próximo día con clases.
- Administración solo se acomoda para no desbordar: se usa en la computadora.

## Pantallas

### Ingreso
- Pantalla 1: mosaico decorativo de bloques pastel, el logo FIUBI en grande, "Tu carrera de FIUBA en un solo lugar" y el botón "Ingresar con tu cuenta @fi.uba.ar". Nada más.
- Cuenta rechazada: debajo del botón, recuadro durazno con "<mail> no es una cuenta de FIUBA" + "Ingresá con tu mail @fi.uba.ar"; el botón pasa a "Probar con otra cuenta".
- Pantalla 2: "¿Qué carrera estudiás?", las 13 carreras en grilla de dos columnas y, si la carrera tiene más de un plan, los planes (el vigente marcado y con la etiqueta "Vigente"; los viejos de carreras que cambiaron de nombre muestran el nombre anterior). "Continuar" lleva al mapa en modo de primera carga.

### Primera carga de materias
- Es el mapa vacío con el título "Cargá tus materias" y un botón "Listo" que lleva al inicio.
- La ficha arranca abierta en la primera materia del CBC. Muestra notas 4–10 ("Aprobada con") y los botones Final pend. / Cursando / Sin cursar. Elegir cualquiera guarda y pasa **sola** a la materia siguiente (CBC y después columna por columna). "← Anterior" y "Siguiente →" para moverse sin cambiar nada.
- La prueba de inglés solo tiene Aprobada / Pendiente. Las electivas se cargan desde su panel, sin avance automático.

### Inicio
- Saludo, aviso de reseñas pendientes cuando las hay, avance (porcentaje y barra dividida CBC / obligatorias, créditos por categoría), promedio, cuadro "Materias" (aprobadas incluyendo CBC y estado de la prueba de inglés), calendario semanal de la cursada actual y "Finales pendientes" con lo que destraba cada uno.
- Calendario de la cursada (programado el 20 de octubre): sale de los cursos en los que el alumno tocó "Me inscribí en esta opción" en el Plan. Mismos colores en el mismo orden que el calendario del plan, bloques que se pisan lado a lado, asincrónicas en una línea aparte y "Ver el plan →". Solo muestra las horas con clases (mínimo 6) y la grilla mide siempre unos 420 px, así cada hora es lo más alta posible; las clases seguidas de un mismo curso (teórica + práctica) son un solo bloque, y el nombre de la materia usa todo el alto del bloque: la línea de curso y horario aparece solo si sobra lugar (si no, queda al pasar el mouse). Sin inscripción en el cuatrimestre actual, queda la lista de materias en "Cursando" del mapa.

### Mapa de la carrera
- Columnas CBC + 1.º a 8.º cuatrimestre, sin flechas. Nodo de 112 × 92 px: nombre (hasta 3 líneas), ícono de estado, nota en 16 px / 700 si está aprobada, créditos "8 C" chiquitos.
- Clic en una materia: ficha flotante con el nombre, los créditos y el estado, los botones Aprobada / Final pendiente / Cursando / Sin cursar y la nota. Lo que necesita y lo que habilita no se listan (cambio del 15 de octubre): se ven en el mapa con contorno sólido y punteado. Si está bloqueada por créditos, la ficha dice cuántos pide. Las que necesita se marcan con contorno sólido; las que habilita, con contorno punteado; el resto baja a 30 % de opacidad.
- "Aprobada" sin nota no se guarda: abre el selector de nota primero.
- CBC compactable en una columna angosta; compactado por defecto cuando está completo.
- Panel de electivas a la derecha (276 px, fondo #F1EEFD) agrupado por área, con filtros Todas / Habilitadas / Bloqueadas y barra de créditos de electivas.
- Buscador de materias que atenúa las que no coinciden.
- **Celular** (menos de 768 px, no está en el prototipo): pestañas "Obligatorias | Electivas"; las obligatorias en secciones plegables por cuatrimestre (abiertas la actual y la siguiente, con una barrita de colores por materia); la ficha sube desde abajo con los mismos botones y, como no hay contornos, lista "Necesita" y "Habilita". El buscador filtra la lista.

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
- **Tu reseña** (agregado el 16 de octubre, no está en el prototipo): tarjeta debajo del puntaje con "Reseñar este curso"; abre las mismas estrellas y comentario que las pendientes. Si ya la escribiste, la muestra con "Editar".
- **Reseñas pendientes:** una tarjeta por curso con estrellas (al pasar el mouse: Muy malo / Malo / Regular / Bueno / Excelente), "+ Agregar un comentario" (hasta 500 caracteres) y "Enviar reseña", deshabilitado hasta elegir estrellas. Barra de progreso "N de 3" y, al completar todas, un aviso verde con "Ir al plan".
- **Filtro al escribir:** si el comentario tiene insultos, teléfonos, mails, links o @usuarios, aparece un aviso en durazno debajo del campo y no se puede enviar.
- Programado el 16 de octubre. Las reseñas abren por cuatrimestre (`terms.reviews_open_on`) y se piden por los cursos que el alumno marcó en `user_courses`; una práctica y su curso cuentan como una sola. El menú muestra en durazno cuántas faltan.

### Perfil y configuración
- Avatar grande con botón de cámara para subir foto ("Quitar foto" cuando hay una); nombre, mail, "Cerrar sesión".
- Carrera: "Ing. Industrial · Plan 2023" + "Cambiar" (selectores de carrera y plan; aviso de que las materias pasan por equivalencias).
- Apariencia: Claro / Oscuro / Según el sistema.
- Mis reseñas: lista con estrellas y comentario, "Editar" en el lugar, acceso a las pendientes y "Se publican sin tu nombre."
- Tus datos: "Descargar mis datos" y "Borrar mi cuenta" con confirmación ("…Tus reseñas siguen publicadas, sin tu nombre. No se puede deshacer.").
- Pie: "Hecho por estudiantes. No es un sitio oficial de la universidad."

- Programado el 16 de octubre sin la foto propia ni "Cambiar" carrera. "Cambiar" (5 de noviembre) va sin equivalencias: el aviso en manteca dice que se borran las materias cargadas y el plan del cuatrimestre, y "Guardar" lleva a la carga rápida del mapa. Con el mismo plan elegido, "Guardar" queda deshabilitado. "Mis reseñas" tiene "Editar" en el lugar (las mismas estrellas y comentario que las pendientes; no aparece en las ocultas por moderación) y, si hay pendientes, un acceso en durazno "N pendientes →" (PR #37).
- Agregado el 16 de octubre (no está en el prototipo): tarjeta "Administración" con "Abrir", solo para administradores, antes de "Tus datos"; y en el pie, "· Privacidad" hacia `/privacidad`, que también se enlaza desde el pie del ingreso.

### Política de privacidad
- `/privacidad`, pública. Columna de texto de 760 px con "← [nombre]", título, fecha de actualización, secciones cortas y la leyenda de la Ley 25.326 en una caja. Sin barra superior, como el ingreso.
### Administración
- Pestañas "Oferta del cuatrimestre" y "Reseñas". Solo para administradores.
- **Oferta:** lista de los 24 planes con un punto de estado (sin cargar / procesado / publicado) y el progreso "N de 24 planes publicados". Fecha de reseñas pendientes arriba.
  - Sin cargar: campo para pegar el texto del SIU + "Procesar".
  - Procesado: resumen (materias, cursos, horarios), "Cursos con cambios" con tres opciones por curso (mismo curso que uno anterior / curso nuevo / no mostrar) y la sugerida ya marcada, "Materias que no están en el plan" y "Publicar" siempre habilitado.
  - Publicado: oferta por materia con buscador; cada curso con "Quitar" / "Volver a mostrar"; "Reemplazar con otro texto".
- **Reseñas:** todas, con buscador (materia, docente o texto) y filtro Todas / Fijadas. Cada una con "Fijar" y "Eliminar" (con deshacer).
