# CLAUDE.md

@AGENTS.md

Instrucciones para Claude Code en este repositorio. Las leen las sesiones de todos los que trabajan en el proyecto, así que todos arrancan con el mismo contexto.

## Qué es

Web gratuita para estudiantes de FIUBA que integra en una sola cuenta lo que hoy hacen FIUBA Map (correlativas y avance), FIUBA Plan (armado del cuatrimestre) y FIUBA Reviews (reseñas de cursos).

Antes de tocar algo, leé:

- `docs/ESTADO.md`: **en qué punto está el proyecto**, qué falta, quién hace qué y quién tiene acceso a cada servicio. Leelo primero.
- `PRODUCTO.md`: qué hace la app, decisiones tomadas y modelo de datos. **Es la fuente de verdad del producto.** Si una tarea contradice este documento, preguntá antes de implementar.
- `docs/DISENO.md`: colores, tipografía, componentes y comportamiento de cada pantalla.
- `docs/diseno/prototipos/`: el código de cada pantalla del diseño. **Antes de programar una pantalla, leé su prototipo.**
- `docs/COLABORACION.md`: cómo trabajamos de a dos con ramas y pull requests.

## Stack

- Next.js (App Router) + TypeScript estricto.
- Tailwind CSS. Los colores del diseño se definen **una sola vez** como variables (claro y oscuro); nunca escribir un color hexadecimal suelto en un componente.
- Supabase: PostgreSQL + login con Google.
- Vercel para el hosting, con vista previa por pull request.

### Comandos

- `npm install`: instala las dependencias (la primera vez y cuando cambia `package.json`).
- `npm run dev`: levanta la web en http://localhost:3000 para probar mientras se programa.
- `npm run build`: compila como en producción. **Tiene que pasar sin errores antes de abrir un pull request.**
- `npm run lint`: revisa el estilo del código.
- `npm test`: corre las pruebas automáticas (Vitest). **Tienen que pasar antes de abrir un pull request.** Los archivos de prueba van al lado del código que prueban, con el nombre `*.test.ts`.

### Estructura

- `src/app/`: una carpeta por sección (`mapa`, `plan`, `resenas`, `perfil`); `page.tsx` es la página.
- `src/components/`: componentes compartidos (barra superior, contenedor de página, botón de tema).
- `src/lib/app.ts`: nombre de la app y menú. El nombre se cambia solo ahí.
- `src/app/globals.css`: **el único lugar con colores.** Variables para claro (`[data-theme="light"]`) y oscuro (`[data-theme="dark"]`) que Tailwind expone como clases: `bg-bg`, `bg-surface`, `bg-header`, `border-line`, `border-line-strong`, `text-ink`, `text-ink-2`, `text-muted`, `bg-accent`, `text-on-accent`, `bg-accent-soft`, `bg-lavender`/`text-lavender-ink`, `bg-mint`/`text-mint-ink`, `bg-butter`/`text-butter-ink`, `bg-sky`/`text-sky-ink`, `bg-peach`/`text-peach-ink`, `bg-pink`/`text-pink-ink` y `bg-teal`/`text-teal-ink` (solo calendario del plan), `text-star`, `text-danger`, `bg-disabled`/`text-disabled-ink`, y para el mapa `border-enabled-line`, `bg-blocked`/`border-blocked-line`/`text-blocked-ink`.
- Tema: `src/lib/theme.ts`. Se guarda en `localStorage` ("claro" | "oscuro" | "sistema") y un script en `<head>` lo aplica antes de pintar.
- Sesión: `src/lib/session.ts` (`requireAccount()`: la verificación definitiva en el servidor, que además crea la fila del alumno en `profiles` la primera vez; `requireProfile()`: lo mismo y además exige haber elegido carrera y plan, si no manda a `/carrera`; la usa el layout de `src/app/(app)/`), `src/lib/auth.ts` (dominio permitido y datos del perfil), `src/lib/supabase/` (clientes de navegador, servidor y proxy) y `src/proxy.ts` (refresca la sesión y manda a `/ingresar` a quien no la tiene).
- `src/app/(app)/`: las secciones que exigen sesión y plan elegido. `src/app/carrera/` es el paso 2 del ingreso (elegir carrera y plan; exige sesión). `src/app/ingresar/`, `src/app/auth/` y `src/app/privacidad/` (política de privacidad, la pide Google para publicar el login) son públicas: se suman en `PUBLIC_PATHS` de `src/lib/supabase/proxy.ts`. El mail de contacto está en `CONTACT_EMAIL` de `src/lib/app.ts`.
- Carreras y planes: `src/lib/careers.ts` (consulta, solo servidor) y `src/lib/plans.ts` (tipos y textos, sirve en cliente y servidor).
- Perfil: `src/app/(app)/perfil/` (apariencia, mis reseñas, `datos/route.ts` descarga los datos en JSON, borrar cuenta con `delete_my_account()`). Reseñas propias: `src/lib/reviews/mine.ts` (`getMyReviews()`, usa `my_reviews()`).
- Reseñas: `src/lib/reviews/` (`catalog.ts`: buscador y ficha del curso, sin reseñas ocultas ni cursos quitados; `pending.ts`: `getReviewRound()` y `countPendingReviews()`, las que le faltan al alumno; `filter.ts`: `commentProblem()`, el filtro de comentarios, que se corre también en el servidor; `types.ts`: tipos que sirven en el cliente) y `src/app/(app)/resenas/` (buscador, `curso/[id]`, `pendientes`, `actions.ts` con `submitReview`). El contador del menú lo calcula `src/app/(app)/layout.tsx`. Para probarlas en local, `tools/local-supabase/sample-offer.mjs` carga oferta y reseñas de ejemplo.
- Inicio: `src/app/(app)/page.tsx` (usa la misma consulta y lógica que el mapa: `creditsByCategory`, `unlockSummary`).
- Mapa: `src/lib/map/model.ts` (lógica pura: estados, créditos, promedio, columnas, orden de la primera carga; la puede reusar el inicio), `src/lib/map/data.ts` (consulta del plan y el avance del alumno) y `src/app/(app)/mapa/` (pantalla; con `?carga=1` es la primera carga).
- Variables de entorno: ver `.env.example`. Para probar en tu computadora, copialo como `.env.local` y completalo.
- Tipografía: IBM Plex Sans servida desde el propio proyecto (`@fontsource/ibm-plex-sans`), sin depender de Google Fonts.

## Base de datos

- Esquema en `supabase/migrations/` (Postgres de Supabase). Modelo y reglas de seguridad comentados en `20261015120000_initial_schema.sql`: leelo antes de agregar tablas.
- **Toda tabla nueva lleva RLS y `grant` explícitos.** La primera migración saca los permisos automáticos de Supabase: si no hacés `grant`, la app no ve la tabla. Nada se le da a `anon`. **Para leer, las políticas piden `(select public.is_member())`** (tener fila en `profiles`, o sea cuenta @fi.uba.ar): una sesión sola no alcanza, porque cualquier cuenta de Google puede conseguir una.
- **El autor de una reseña está en `review_authors`, que ningún usuario puede leer.** Las reseñas se escriben con `submit_review()` (pendientes, de un curso cursado) o `review_course()` (libre, cualquier curso desde su ficha), y cada uno ve las suyas con `my_reviews()`. Una reseña por alumno y curso: las dos funciones editan la existente.
- Los alumnos solo leen y escriben sus propias filas. Los administradores (`profiles.is_admin`, que nadie puede cambiarse desde la app) escriben el catálogo y la oferta y moderan reseñas.
- Un administrador es un alumno más con permisos extra. Ojo: la base le deja ver reseñas ocultas (`hidden_at`) y cursos quitados (`visible = false`). Las pantallas de alumno tienen que filtrarlos siempre (`hidden_at is null`, `visible = true`), así el administrador ve lo mismo que cualquiera.
- Planes: `20261015120100_seed_plans.sql` se genera con `npm run db:seed` desde `data/planes/` y `data/planes/planes.json`. No se edita a mano; una migración ya aplicada nunca se cambia: los arreglos van en una migración nueva.
- **Pruebas:** `npm run db:test` aplica todas las migraciones a un Postgres vacío y corre `tools/db-test/security.sql` (quién puede leer y escribir qué). Necesita un Postgres local (variables `PGHOST`, `PGUSER`…). En cada pull request corren solas en GitHub (workflow "Base de datos").
- **Probar de punta a punta sin el Supabase real:** `tools/local-supabase/` levanta una copia local de la base con su API y un usuario de prueba (ver su README). Sirve para probar pantallas con Playwright antes de abrir el pull request.
- **Cómo llegan a Supabase:** al integrarse a `main`, el workflow "Base de datos" aplica las migraciones nuevas. Para probar una vista previa antes, se puede correr a mano desde GitHub → Actions → Base de datos → Run workflow, eligiendo la rama (aplica en la base compartida: solo si la migración está lista).
- Nombres de migración: `AAAAMMDDHHMMSS_descripcion.sql`, siempre con fecha posterior a la última.

## Reglas que no se negocian

1. **Login solo @fi.uba.ar, verificado en el servidor.** No alcanza con sugerirle el dominio a Google: cada sesión se valida del lado del servidor y cualquier otro dominio se rechaza.
2. **Reseñas anónimas.** Ninguna respuesta de la API, consulta pública ni pantalla puede exponer quién escribió una reseña. La referencia al autor existe solo para evitar duplicados y permitir editar; al borrar la cuenta se elimina y la reseña queda publicada sin autor.
3. **Una sola carrera y un solo plan por cuenta.**
4. **La base de datos se cambia solo con migraciones** dentro del repo (`supabase/migrations`). Nunca a mano desde el panel de Supabase.
5. **Sin secretos en el repo.** Claves y tokens van en `.env.local`, que está en `.gitignore`. Si hace falta una variable nueva, se agrega su nombre (sin valor) a `.env.example`.
6. **Nunca trabajar directo sobre `main`.** Cada tarea en su rama y con pull request (ver `docs/COLABORACION.md`).
7. **Nombres oficiales de los planes.** FIUBA Map llama "2020" a los planes 2023/2024; en la app y en la base se usa el nombre oficial (tabla en `data/planes/README.md`).

## Convenciones

- Código, nombres de variables, tablas y commits en inglés. Textos de la interfaz en español rioplatense, con voseo ("Elegí", "Tocá", "Tenés").
- Interfaz minimalista: nada de textos explicativos de relleno. Si una pantalla necesita una explicación para entenderse, el problema es el diseño.
- Números con ancho fijo (`font-variant-numeric: tabular-nums`). Decimales con coma: "7,76".
- Créditos se muestran como "8 C". Horarios como "Lun 18–22 hs · Paseo Colón".
- Escritorio primero: la versión 1 no se diseña para celular.

## Datos

- `data/planes/`: los 25 planes de FIUBA Map (24 se usan). Formato y correspondencias en su README. `planes.json` tiene las carreras, los nombres oficiales, los créditos y requisitos de cada plan. `areas.json` agrupa las electivas de cada plan por área para el panel del mapa; se carga con `node tools/plans-seed/areas.mjs` (genera una migración nueva).
- `data/siu/`: ofertas reales del 2C 2026 para las pruebas del intérprete. Industrial en formato "detalle" (texto y versión interpretada) y Civil, Informática y Química en formato "tabla pública".
- `src/lib/siu/`: intérprete del SIU. `parseSiuOffer(texto)` reconoce los dos formatos del SIU ("detalle", del SIU con sesión, con docentes, modalidad y prácticas; y "tabla pública" de Horarios de cursada, que trae todas las carreras pero solo el titular en el nombre del curso) y devuelve la oferta (materias → comisiones → subcomisiones → horarios) y una lista de avisos para el administrador. Sus pruebas comparan el resultado con `data/siu/`.
- `src/app/admin/`: Administración (prototipo 13), solo para administradores (`requireAdmin()` en `src/lib/admin/data.ts`). Cuatrimestre actual, fecha de reseñas y oferta por plan: pegar el texto del SIU → **Procesar** (guarda texto y resumen en `offer_imports`) → **Publicar** (escribe `offerings` y `offering_blocks`, y recuerda los códigos del SIU en `subject_siu_codes`). La lógica pura está en `src/lib/admin/offer-import.ts`: empareja materias por código conocido o por nombre, una fila de `offerings` por práctica, y todas las prácticas de una comisión comparten `course_id` (también entre planes del mismo cuatrimestre; entre cuatrimestres, si mantiene número y titular). **Nunca se borran filas de `offerings` de una oferta publicada** (de ellas dependen `plan_choices`, `user_courses` y las reseñas): "Reemplazar con otro texto" actualiza en el lugar las filas que siguen (misma materia, número y práctica: `offeringKey()`), agrega las nuevas y oculta (`visible = false`) las que ya no están; "Quitar" también solo oculta. Mientras un reemplazo está procesado sin publicar, `offer_imports.parsed.replacing` guarda la publicación anterior para que "Descartar" la restaure. En "Materias que no están en el plan", **Emparejar** (`linkSiuSubject()`) guarda en `subject_siu_codes` que un código del SIU es una materia del plan (nombres abreviados de la tabla pública) y recalcula el resumen; solo con el texto procesado, antes de publicar. **Cursos con cambios** (`detectCourseChanges()`): al procesar, cada comisión se compara con la misma materia en el último cuatrimestre anterior; si cambió el titular, el número, o es nueva, se lista con "Mismo curso que…" / "Curso nuevo" / "No mostrar" y la sugerida marcada. La elección (`setCourseDecision()`, en `parsed.decisions`) decide el `course_id` al publicar: "mismo curso" conserva las reseñas.
- `src/app/(app)/plan/`: pantalla del plan (`PlanBuilder.tsx`). Los datos los arma `getPlanData()` (`src/lib/plan/data.ts`): la oferta publicada del cuatrimestre actual para el plan del alumno (solo `visible`), solo materias habilitadas o en curso según su mapa, puntajes de reseñas y la Opción A / B guardada. Cada cambio se guarda solo con `savePlanOption()` (`actions.ts`) en `plan_choices` (una fila por curso elegido y opción; solo cursos visibles del plan propio). **"Me inscribí en esta opción"** (`enrollInCourses()`) pasa los cursos de la opción a `user_courses`, la cursada del cuatrimestre actual (reemplaza la de este cuatrimestre, no toca las anteriores): de ahí salen las reseñas pendientes. Además marca esas materias como "Cursando" en el mapa (`user_subjects`) y desmarca las de la cursada anterior que ya no están, solo si estaban en "Cursando".
- `src/lib/plan/`: lógica del plan del cuatrimestre. `courseOptions(materia)` arma los cursos elegibles (uno por práctica cuando hay prácticas; sin CONDICIONALES ni cursos "i") y `analyzePlan(cursos)` devuelve superposiciones, traslados apurados entre sedes (menos de 60 minutos), asincrónicas y totales.
- `tools/siu-parser/`: prototipo original en Python del intérprete. Ya no se usa en la app; queda como referencia. Si cambian las reglas, se cambian en `src/lib/siu/`.

## Licencias

`LICENSES/FIUBA-Map.txt` tiene que quedar en el repo mientras usemos sus datos. Si se reutiliza código de FIUBA Plan, agregar su licencia en la misma carpeta.
