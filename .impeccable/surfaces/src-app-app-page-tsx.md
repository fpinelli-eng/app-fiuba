---
version: 1
slug: "src-app-app-page-tsx"
primary_target: "src/app/(app)/page.tsx"
related_targets: []
---

Scope: Inicio (src/app/(app)/page.tsx), modo Operate. Primera pantalla del rediseño visual; el lenguaje que fija acá se lleva después al resto de la app.

Audiencia y tarea: alumnos de la FIUBA que planifican la carrera y hacen consultas rápidas. Al entrar tienen que ver, sin buscar, cuánto avanzaron, su promedio, sus créditos y sus materias aprobadas.

Restricciones de Francisco (5 de noviembre de 2026): curvas y pasteles se quedan (aceptó resignar originalidad por eso); minimalista, poco texto, nada de metáforas estudiantiles. Avance, promedio y créditos van arriba de todo. Lienzo de referencia: "App FIUBA · Direcciones visuales", tablero "Inicio ajustado" (Ronda 5).

## Direction contract

THESIS: la carrera es un recorrido que se llena. El Inicio responde "¿cómo voy?" con un solo gráfico en arco, y rechaza el tablero de métricas sueltas en tarjetas iguales.

OWN-WORLD: fondo gris azulado muy claro (#F6F7FA), tinta azul noche (#1F2537), paleta media coherente: amarillo #F0B54A (CBC), azul #5B7FE3 (obligatorias, acento), coral #EE8B7B (electivas), verde salvia #67B39A; fondos pastel de esos tonos (verde #DFF2E9 para el promedio, celeste #E4ECFC, coral #FCEBE7). Unbounded para títulos y números, Onest para el texto. Bloques muy redondeados (24–32 px), menú de texto con un punto bajo la sección activa.

STORY: el alumno ve dónde está en la carrera de un vistazo, confirma su promedio y sus materias aprobadas, y baja a la semana o a sus finales si lo necesita.

FIRST VIEWPORT: "Hola, <nombre>" en grande arriba de todo. Debajo, a la izquierda (1,7 fr), el avance: arco de 180° que mide créditos, con los tramos apilados por categoría (CBC, obligatorias, electivas), paradas por año (CBC, 2.º, 3.º, 4.º, título) ubicadas por los créditos del plan sugerido, la punta del relleno marcada, y adentro el porcentaje, "N de M créditos" y el año. A la derecha (1 fr): promedio en verde, materias aprobadas en celeste y, si hay, el aviso de reseñas pendientes en coral. Más abajo: la semana (lunes a viernes, hoy marcado) y los finales pendientes.

FORM: dirección guiada por el usuario a partir de la tercera ronda ("Recorrido", colectivos porteños, n.º 1 de mi lista) con el gráfico de barra del "Kiosco"; seed: 522a853b84d691df

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
