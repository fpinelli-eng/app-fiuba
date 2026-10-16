# Estado del proyecto

Resumen para que cualquier persona (o cualquier sesión de Claude) sepa en qué punto estamos sin haber estado en las conversaciones anteriores. **Se actualiza en cada pull request que cambie algo de lo que dice acá.**

Última actualización: 16 de octubre de 2026.

## Cómo se llegó hasta acá

1. **Producto** (septiembre–octubre 2026): se definió qué hace la app y por qué. Todo está en `PRODUCTO.md`, incluidas las decisiones cerradas y las abiertas.
2. **Diseño** (5–9 de octubre): se diseñaron las 13 pantallas en un lienzo de Claude Design, iterando pantalla por pantalla con Francisco. El resultado está en el repo: `docs/DISENO.md` (colores, tipografía, comportamiento) y `docs/diseno/prototipos/` (el código de cada pantalla, que es la referencia exacta).
3. **Código** (desde el 9 de octubre): ver "Qué está hecho".

## Qué está hecho

| Qué | Dónde | Estado |
|---|---|---|
| Documento de producto | `PRODUCTO.md` | v0.5 |
| Diseño de las 13 pantallas | `docs/DISENO.md`, `docs/diseno/prototipos/` | Terminado |
| Proyecto base: Next.js 16, Tailwind 4, colores claro/oscuro, tipografía, barra superior, páginas vacías | `src/app/`, `src/components/` | En `main` (#1, PR #4) |
| Login con Google solo @fi.uba.ar, verificado en el servidor; pantalla de cuenta rechazada; perfil con cerrar sesión | `src/lib/session.ts`, `src/lib/auth.ts`, `src/lib/supabase/`, `src/proxy.ts`, `src/app/ingresar/`, `src/app/auth/` | En `main` (#2, PR #9), probado en producción |
| Intérprete del SIU en TypeScript, con pruebas | `src/lib/siu/` | En `main` (#5, PR #10) |
| El intérprete también lee la tabla pública de "Horarios de cursada" (todas las carreras, sin docentes) | `src/lib/siu/`, `data/siu/*_tabla-publica.txt` | En `main` (PR #32) |
| Administración: cuatrimestre actual, fecha de reseñas, cargar la oferta del SIU por plan (procesar, resumen, materias fuera del plan, publicar) y ver la oferta publicada | `src/app/admin/`, `src/lib/admin/` | En `main` (PR #33) |
| Lógica del plan: cursos elegibles, superposiciones, traslados | `src/lib/plan/` | En `main` (#11, PR #12) |
| Pantalla del plan del cuatrimestre con datos de prueba (oferta real de Industrial 2C 2026), sin guardado | `src/app/(app)/plan/`, `src/lib/plan/sample-offer.ts` | En `main` (PR #14) |
| Base de datos: esquema con seguridad por fila, los 24 planes cargados, pruebas de seguridad y aplicación automática en Supabase; paso de elegir carrera y plan | `supabase/`, `tools/db-test/`, `tools/plans-seed/`, `src/app/carrera/` | En `main` (#3, PR #15) |
| Mapa de la carrera y primera carga de materias, guardando en la base | `src/lib/map/`, `src/app/(app)/mapa/` | En `main` (#17, PR #18) |
| Inicio: avance, promedio, materias, cursando y finales pendientes | `src/app/(app)/page.tsx` | En `main` (#24, PR #25) |
| Mapa: web en São Paulo (`gru1`), botón "Carga rápida", ficha simplificada (sin "Necesita" ni "Habilita") | `vercel.json`, `src/app/(app)/mapa/` | En `main` (PR #21, #26, #27) |
| Perfil: apariencia, mis reseñas, descargar mis datos, borrar mi cuenta | `src/app/(app)/perfil/`, `src/lib/reviews/mine.ts`, `supabase/migrations/20261016120000_delete_my_account.sql` | En `main` (PR #28) |
| Reseñas: buscador, ficha del curso, reseñas pendientes con filtro de comentarios, contador en el menú y aviso en el inicio. Solo leen la oferta: hasta que se cargue, el buscador muestra "No se dicta este cuatrimestre" | `src/lib/reviews/`, `src/app/(app)/resenas/`, `tools/local-supabase/sample-offer.mjs` | En `main` (#30, PR #31) |
| Reseñas libres: cualquier alumno reseña cualquier curso desde su ficha ("Tu reseña"); una reseña por alumno y curso, que se edita | `supabase/migrations/20261016140000_free_reviews.sql`, `src/app/(app)/resenas/curso/[id]/MyReview.tsx` | PR abierto (#34, PR #35) |
| Seguridad: leer catálogo, oferta y reseñas exige cuenta FIUBA (no alcanza con una sesión de Google); cursadas solo del propio plan | `supabase/migrations/20261015170000_member_only_reads.sql` | En `main` (PR #20) |
| Colores extra del calendario del plan (rosa y verde agua) | `src/app/globals.css` | En `main` (PR #19) |
| Planes de la beta (Industrial, Informática y Química 2023) verificados contra sus resoluciones oficiales, con las correcciones en una migración. Los demás planes hay que verificarlos igual antes de sumar su carrera | `data/planes/README.md`, `supabase/migrations/20261016180000_verified_plans_fixes.sql` | PR abierto (#39) |

## Qué falta, en orden

1. **Administración, lo que falta:** quitar o volver a mostrar cursos, reemplazar la oferta de un plan con otro texto (conservando los cursos, para no perder sus reseñas), cursos con cambios respecto del cuatrimestre anterior y emparejar a mano materias con nombres abreviados. Segundo desarrollador.
2. **Plan del cuatrimestre conectado a la base** (hoy usa `src/lib/plan/sample-offer.ts`), solo materias habilitadas, y guardar Opción A / B en su propia migración. Segundo desarrollador.
3. **Reseñas, lo que falta:** "Editar" en el perfil. La pantalla del plan bloqueado puede usar `getReviewRound()` y `countPendingReviews()` de `src/lib/reviews/pending.ts`. Francisco.
4. **Perfil, lo que falta:** subir una foto propia (necesita almacenamiento de archivos en Supabase). "Cambiar" carrera o plan queda para el final: decidido sin equivalencias, se borran las materias y se cargan de nuevo. Francisco.
5. **Inicio, lo que falta:** calendario de la cursada (con la oferta y el plan guardado).
6. **Moderación de reseñas** (administración).
7. **#8 · Política de privacidad** y publicación de la app en Google, antes del lanzamiento. Revisar ahí también la protección de las vistas previas de Vercel.
8. Abiertas en `PRODUCTO.md` (sección 13): nombre y dominio, plan 2014 de Sistemas, áreas de electivas de los demás planes.

**Beta (decidido el 16 de octubre):** primero con tres carreras, Industrial, Química e Informática, cargadas con la oferta completa del SIU con sesión (prácticas, docentes y horarios de cada práctica). La prueban alumnos de confianza de esas carreras. Las demás carreras se suman después pegando su oferta en `/admin`, sin cambiar código; la tabla pública del SIU también sirve, con menos detalle. En la beta lo primero que se usa son las reseñas libres: las pendientes y el plan dependen de que el alumno haya armado su plan en la app.

**Administradores:** Francisco y el segundo desarrollador (`profiles.is_admin`), marcados desde el editor SQL de Supabase. Para sumar a alguien: `update profiles set is_admin = true where id = (select id from auth.users where email = '<mail>');` (tiene que haber entrado a la web al menos una vez).

**Migraciones:** se aplican solas al integrarse a `main`. GitHub entra a Supabase con el secreto `SUPABASE_DB_PASSWORD` por el *session pooler* (IPv4), sin token.

## Cómo está armado GitHub

- **Repositorio:** `fpinelli-eng/app-fiuba`, público. Dueño: Francisco.
- **`main`** es la versión publicada. Está protegida: todo entra por pull request.
- **Colaborador:** el segundo desarrollador tiene permiso de escritura: crea ramas, abre y fusiona pull requests, maneja Issues. No puede cambiar la configuración del repo.
- **Por acuerdo, nadie fusiona su propio pull request sin que el otro lo vea**, salvo cambios que solo tocan documentación.
- **Issues** con etiquetas por área: `base`, `mapa`, `plan`, `reseñas`, `admin`.
- Flujo completo en `docs/COLABORACION.md`.

## Servicios y quién tiene acceso

| Servicio | Para qué | Cuenta | Acceso del segundo desarrollador |
|---|---|---|---|
| GitHub | Código | Francisco | Colaborador con escritura |
| Vercel | Publica la web; una vista previa por pull request | Francisco (plan gratuito) | No es miembro. Desde el 15 de octubre las vistas previas no piden sesión de Vercel (*Deployment Protection* desactivada): las protege el login de la app. **Antes del lanzamiento (#8), revisar:** las vistas previas usan la misma base que producción |
| Supabase | Base de datos y login (plan gratuito: el proyecto se pausa tras una semana sin uso; se reactiva con *Restore project*) | Francisco | Ninguno. Las migraciones van en el repo y GitHub las aplica solo al integrarse a `main` (workflow "Base de datos") |
| Google Cloud | Credenciales de "Ingresar con Google" | Francisco | Ninguno. Para entrar a la app mientras está en modo prueba, su mail @fi.uba.ar tiene que estar en *Test users* |

**Variables de entorno:** las dos de `.env.example` (URL y publishable key de Supabase) son públicas por diseño, pero no se suben al repo: Francisco las pasa por mensaje privado. La contraseña de la base, el *client secret* de Google y la *secret key* de Supabase **nunca** se comparten ni se suben.

## Cómo trabajar con Claude en este proyecto

- **Usá Claude Code sobre el repo**, no un chat suelto: así lee `CLAUDE.md` y estos documentos solo.
- **Antes de empezar:** `git switch main && git pull`, para tener lo último.
- **La fuente de verdad es el repo.** No hace falta subir archivos del diseño a Claude: está todo en `docs/`. Las copias sueltas (PDF, zip) son solo respaldo y pueden quedar viejas.
- Si Claude necesita decidir algo que los documentos no resuelven, lo anota en el Issue y lo decidimos entre los dos.
