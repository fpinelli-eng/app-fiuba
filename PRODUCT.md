# Product

<!-- impeccable:product-schema 1 -->

Resumen para la skill Impeccable (`.claude/skills/impeccable/`). La fuente de verdad del producto es `PRODUCTO.md`; si algo de acá la contradice, vale `PRODUCTO.md`.

## Platform

web

## Users

Estudiantes de grado de la FIUBA (Facultad de Ingeniería de la UBA), con cuenta @fi.uba.ar: las 13 carreras y 24 planes de estudio. La beta arranca con Ingeniería Industrial, Química e Informática (plan 2023). Usan la app sobre todo para planificar la carrera (qué tienen aprobado, qué destraba cada final, cuánto falta) y para consultas rápidas entre clases o en viaje (qué curso tienen hoy, cuándo es un final). En segundo lugar, para armar el horario del cuatrimestre y escribir reseñas al terminar la cursada.

Los administradores (Francisco y Jantus) cargan la oferta del SIU cada cuatrimestre y moderan reseñas desde `/admin`.

## Product Purpose

Reemplazar tres herramientas sueltas hechas por estudiantes (FIUBA Map, FIUBA Plan y FIUBA Reviews) por una sola web gratuita y sin fines de lucro, con cuenta personal: las materias aprobadas definen qué se puede cursar, eso filtra los cursos del plan del cuatrimestre, y cada curso muestra su puntaje de reseñas. Éxito: que los alumnos dejen las tres herramientas viejas porque esta es más clara, más rápida y más confiable.

## Positioning

Es la única que conecta todo: el avance del alumno, la oferta real del SIU de su plan y las reseñas de cada curso, con una sola cuenta @fi.uba.ar verificada. La estética y la facilidad de uso son el diferencial frente a herramientas gratuitas que ya funcionan.

## Operating Context

- Se usa en la computadora y en el celular por igual (decidido el 5 de noviembre de 2026): el diseño se piensa para los dos desde el arranque.
- Secciones: Inicio (avance, promedio, cursada de la semana, finales pendientes), Mapa (correlativas por cuatrimestre), Plan (horario con Opción A / B), Reseñas, Finales (mesas de examen), Novedades (calendario académico y avisos), Perfil y Administración.
- Vocabulario de la facultad: cuatrimestre (1C / 2C), CBC, créditos ("8 C"), final pendiente, cursada, curso, sede (Paseo Colón, Las Heras), SIU, mesa de examen.
- Textos en español rioplatense, con voseo.

## Capabilities and Constraints

- Todo el detalle en `PRODUCTO.md`, `docs/ESTADO.md` y `CLAUDE.md`.
- Next.js + Tailwind; los colores se definen una sola vez como variables en `src/app/globals.css`, en tema claro y oscuro.
- Reseñas siempre anónimas. Una sola carrera y un solo plan por cuenta.
- Pendiente: nombre y dominio de la app (hoy "[NOMBRE]") y mail de contacto.

## Brand Commitments

- No es un sitio oficial de la universidad: sin logos de la FIUBA ni de la UBA, y se aclara en el pie.
- Pedido explícito de Francisco (5 de noviembre de 2026): minimalista y sobria, con la legibilidad primero. La información se tiene que leer e interpretar de un vistazo. El diferencial no viene de metáforas del mundo estudiantil (libretas, cuadernos, sellos, resaltadores, correcciones) ni de adornos que dificulten la lectura, sino de la calidad de la tipografía, el color, la jerarquía y el espacio. La estética actual (lavanda, pasteles, IBM Plex Sans, tarjetas muy redondeadas) le gusta pero se ve genérica, "hecha por IA": no tiene que parecerse a eso.

## Evidence on Hand

- Planes de estudio reales en `data/planes/` y ofertas reales del SIU del 2C 2026 en `data/siu/`.
- No hay testimonios, métricas de uso ni usuarios reales todavía: la beta no arrancó. No inventarlos.

## Product Principles

1. Todo conectado: un dato que el alumno carga una vez sirve en todas las pantallas.
2. Leer de un vistazo: la respuesta a "¿cómo voy?" y "¿qué tengo hoy?" se entiende sin esfuerzo.
3. Datos confiables antes que lindos: correlativas y horarios verificados.
4. Sin textos de relleno: si una pantalla necesita explicación, el problema es el diseño.

## Accessibility & Inclusion

WCAG 2.2 nivel AA en claro y oscuro: contraste, uso completo con teclado y foco visible, el color nunca como única señal, texto legible con zoom al 200 % y zonas de toque cómodas en el celular.
