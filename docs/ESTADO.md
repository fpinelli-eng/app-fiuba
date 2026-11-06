# Estado del proyecto

Resumen para que cualquier persona (o cualquier sesión de Claude) sepa en qué punto estamos sin haber estado en las conversaciones anteriores. **Se actualiza en cada pull request que cambie algo de lo que dice acá.**

Última actualización: 6 de noviembre de 2026.

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
| Pantalla del plan del cuatrimestre (PR #14); ahora lee la oferta de la base, solo materias habilitadas, con puntajes y guardado de Opción A / B | `src/app/(app)/plan/`, `src/lib/plan/data.ts`, `supabase/migrations/20261016170000_plan_choices.sql` | En `main` (PR #38) |
| Plan del cuatrimestre en celular: Materias / Semana, hoja para elegir el curso, agenda por día y barra con totales y "Me inscribí"; escritorio sin cambios | `src/app/(app)/plan/PlanMobile.tsx` | PR abierto |
| Base de datos: esquema con seguridad por fila, los 24 planes cargados, pruebas de seguridad y aplicación automática en Supabase; paso de elegir carrera y plan | `supabase/`, `tools/db-test/`, `tools/plans-seed/`, `src/app/carrera/` | En `main` (#3, PR #15) |
| Mapa de la carrera y primera carga de materias, guardando en la base | `src/lib/map/`, `src/app/(app)/mapa/` | En `main` (#17, PR #18) |
| Inicio: avance, promedio, materias, cursando y finales pendientes | `src/app/(app)/page.tsx` | En `main` (#24, PR #25); rediseño con el arco de avance en la rama `inicio` |
| Mapa: web en São Paulo (`gru1`), botón "Carga rápida", ficha simplificada (sin "Necesita" ni "Habilita") | `vercel.json`, `src/app/(app)/mapa/` | En `main` (PR #21, #26, #27) |
| Perfil: apariencia, mis reseñas, descargar mis datos, borrar mi cuenta | `src/app/(app)/perfil/`, `src/lib/reviews/mine.ts`, `supabase/migrations/20261016120000_delete_my_account.sql` | En `main` (PR #28) |
| Reseñas: buscador, ficha del curso, reseñas pendientes con filtro de comentarios, contador en el menú y aviso en el inicio. Solo leen la oferta: hasta que se cargue, el buscador muestra "No se dicta este cuatrimestre" | `src/lib/reviews/`, `src/app/(app)/resenas/`, `tools/local-supabase/sample-offer.mjs` | En `main` (#30, PR #31) |
| Reseñas libres: cualquier alumno reseña cualquier curso desde su ficha ("Tu reseña"); una reseña por alumno y curso, que se edita | `supabase/migrations/20261016140000_free_reviews.sql`, `src/app/(app)/resenas/curso/[id]/MyReview.tsx` | En `main` (#34, PR #35) |
| Política de privacidad pública (`/privacidad`, Ley 25.326), enlazada desde el ingreso y el perfil; acceso a Administración desde el perfil (solo administradores). Falta definir el mail de contacto (`CONTACT_EMAIL`) | `src/app/privacidad/`, `src/lib/app.ts` | En `main` (#8, PR #36) |
| Seguridad: leer catálogo, oferta y reseñas exige cuenta FIUBA (no alcanza con una sesión de Google); cursadas solo del propio plan | `supabase/migrations/20261015170000_member_only_reads.sql` | En `main` (PR #20) |
| Mapa en el celular: lista por cuatrimestre, pestañas Obligatorias / Electivas y ficha desde abajo (desde 768 px queda igual) | `src/app/(app)/mapa/MobileMap.tsx` | PR #55 abierto |
| Versión para celular (360–430 px): barra de pestañas abajo, barra superior compacta, calendario del inicio día por día y pantallas sin desborde. Desde 768 px queda igual que en la computadora. El mapa y el plan se adaptan en PRs aparte | `src/components/Header.tsx`, `src/components/icons.tsx`, `src/lib/app.ts`, `src/app/(app)/HomeDayView.tsx` | PR abierto |
| Colores extra del calendario del plan (rosa y verde agua) | `src/app/globals.css` | En `main` (PR #19) |
| Fechas de examen con horario: el administrador pega el enlace de la búsqueda del SIU y se cargan hora, aula, docentes y fecha tope para bajas de cada mesa; Finales los muestra | `src/lib/siu/exams-html.ts`, `src/lib/siu/exams-fetch.ts`, `src/app/admin/examenes/`, `src/app/(app)/finales/`, `supabase/migrations/20261102170000_exam_tables_details.sql` | PR abierto |
| Planes de la beta (Industrial, Informática y Química 2023) verificados contra sus resoluciones oficiales, con las correcciones en una migración. Los demás planes hay que verificarlos igual antes de sumar su carrera | `data/planes/README.md`, `supabase/migrations/20261016180000_verified_plans_fixes.sql` | En `main` (PR #39) |
| Supabase: consulta cada 3 días para que el plan gratuito no pause el proyecto, y respaldo semanal cifrado de `public` y `auth` (30 días, como *artifact*). **Falta que Francisco cree el secreto `BACKUP_PASSPHRASE`** | `.github/workflows/keepalive.yml`, `.github/workflows/backup.yml`, `docs/RESPALDOS.md` | PR #54 abierto |

## Qué falta, en orden

**Rediseño visual en curso (desde el 5 de noviembre de 2026: la base en la rama `rediseno`, PR #62; el Inicio nuevo en `inicio`; después, una rama por pantalla).** Francisco eligió la dirección del Inicio: arco de avance por créditos, paleta pastel media (amarillo, azul, coral, verde), Unbounded + Onest, bloques muy redondeados. Referencia: lienzo "App FIUBA · Direcciones visuales", tablero "Inicio ajustado"; contrato en `.impeccable/surfaces/src-app-app-page-tsx.md`. Se diseña con la skill Impeccable (`.claude/skills/impeccable/`, resumen de producto en `PRODUCT.md`). **Mientras dure, nadie cambia estilos de pantallas (clases, colores, tipografía) fuera de las ramas del rediseño: solo lógica o datos**, para no pisarse.

0. **Fechas de examen y novedades** (acordado el 2 de noviembre): carga de fechas de examen en Administración (PR #50), sección **Finales** para los alumnos (sus finales pendientes primero, todas las mesas con buscador; PR #51) y sección **Novedades** (calendario académico de la FIUBA y avisos de los administradores, que se publican desde Administración → Novedades; PR #52), ya en `main`. El horario, el aula y los docentes de cada mesa, cargando las fechas con el enlace de la búsqueda del SIU, también (PR #53). El calendario se carga una vez por año desde el PDF (`data/calendario/README.md`). **Noticias de la FIUBA en Novedades** (pedido de Francisco, 6 de noviembre): un workflow copia cada dos horas las noticias destacadas de www.fi.uba.ar; el calendario queda resumido en "Próximas fechas". Segundo desarrollador; Francisco decide el diseño.
1. **Administración, lo que falta:** agregar electivas nuevas al plan. Ya están en `main`: quitar / volver a mostrar cursos y reemplazar la oferta sin borrar (PR #41), emparejar a mano materias (PR #44), cursos con cambios entre cuatrimestres (PR #45) y moderación de reseñas (PR #43). Detalle: un curso que un reemplazo ocultó por no estar en el SIU no vuelve a mostrarse solo si reaparece; se muestra a mano. Segundo desarrollador.
2. **Plan del cuatrimestre:** completo para la beta (plan bloqueado por reseñas pendientes, PR #42). Las opciones A y B son borradores; lo que el alumno cursa de verdad lo confirma aparte con **"Confirmar mi cursada"** (reemplaza a "Me inscribí en esta opción" del PR #40, decidido el 6 de noviembre): elige en cada materia el curso en el que quedó, y eso pasa al Inicio y al mapa sin tocar las opciones. Industrial, Química e Informática 2023 ya tienen publicada la oferta completa del 2C 2026. **Ojo con "Reseñas pendientes desde"** del cuatrimestre actual: con una fecha ya pasada, a todos los que confirmaron su cursada se les bloquea el Plan al instante. Tiene que ser una fecha de fin de cursada.
3. **Reseñas:** completas para la beta.
4. **Perfil, lo que falta:** subir una foto propia (necesita almacenamiento de archivos en Supabase). Francisco. "Cambiar" carrera o plan: hecho (sin equivalencias: `change_my_plan()` borra materias, requisitos y plan del cuatrimestre; quedan las cursadas y las reseñas; lleva a la carga rápida del mapa).
5. **Inicio:** hecho, con el calendario de la cursada (PR #47).
6. **Moderación de reseñas:** hecha (PR #43).
7. **#8 · Publicar el login en Google**, antes de la beta: hasta entonces solo entran los usuarios de prueba cargados a mano en Google Cloud. La política de privacidad ya está; falta el mail de contacto y que Francisco cargue la página principal y la de privacidad en Google Cloud (Branding) y publique (Audience). Revisar ahí también la protección de las vistas previas de Vercel.
8. Abiertas en `PRODUCTO.md` (sección 13): dominio (el nombre ya está: FIUBI), plan 2014 de Sistemas, áreas de electivas de los demás planes.

**Beta (decidido el 16 de octubre):** primero con tres carreras, Industrial, Química e Informática, cargadas con la oferta completa del SIU con sesión (prácticas, docentes y horarios de cada práctica). La prueban alumnos de confianza de esas carreras. Las demás carreras se suman después pegando su oferta en `/admin`, sin cambiar código; la tabla pública del SIU también sirve, con menos detalle. En la beta lo primero que se usa son las reseñas libres: las pendientes y el plan dependen de que el alumno haya armado su plan en la app.

**Administradores:** Francisco y el segundo desarrollador (`profiles.is_admin`), marcados desde el editor SQL de Supabase. Para sumar a alguien: `update profiles set is_admin = true where id = (select id from auth.users where email = '<mail>');` (tiene que haber entrado a la web al menos una vez).

**Migraciones:** se aplican solas al integrarse a `main`. GitHub entra a Supabase con el secreto `SUPABASE_DB_PASSWORD` por el *session pooler* (IPv4), sin token.

**Supabase activo y respaldos** (`docs/RESPALDOS.md`): el workflow "Mantener Supabase activo" consulta la base cada 3 días para que no se pause (si falla, llega un mail: probablemente ya se pausó). "Respaldo de la base" guarda los lunes una copia cifrada de los datos, 30 días, como *artifact* de la corrida (el repo es público: sin cifrar no se sube nunca). Necesita el secreto `BACKUP_PASSPHRASE`, que crea Francisco y guarda en un lugar seguro: sin esa contraseña los respaldos no se abren. Cómo descargar, descifrar y restaurar: en ese documento. **GitHub apaga los workflows programados tras 60 días sin commits en el repo**: si pasa, se prenden de nuevo en Actions → Enable workflow.

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
| Supabase | Base de datos y login (plan gratuito: el proyecto se pausa tras una semana sin uso, lo evita el workflow "Mantener Supabase activo"; si igual pasa, se reactiva con *Restore project*. Sin respaldos descargables: los hace el workflow "Respaldo de la base") | Francisco | Ninguno. Las migraciones van en el repo y GitHub las aplica solo al integrarse a `main` (workflow "Base de datos") |
| Google Cloud | Credenciales de "Ingresar con Google" | Francisco | Ninguno. Para entrar a la app mientras está en modo prueba, su mail @fi.uba.ar tiene que estar en *Test users* |

**Variables de entorno:** las dos de `.env.example` (URL y publishable key de Supabase) son públicas por diseño, pero no se suben al repo: Francisco las pasa por mensaje privado. La contraseña de la base, el *client secret* de Google y la *secret key* de Supabase **nunca** se comparten ni se suben.

## Cómo trabajar con Claude en este proyecto

- **Usá Claude Code sobre el repo**, no un chat suelto: así lee `CLAUDE.md` y estos documentos solo.
- **Antes de empezar:** `git switch main && git pull`, para tener lo último.
- **La fuente de verdad es el repo.** No hace falta subir archivos del diseño a Claude: está todo en `docs/`. Las copias sueltas (PDF, zip) son solo respaldo y pueden quedar viejas.
- Si Claude necesita decidir algo que los documentos no resuelven, lo anota en el Issue y lo decidimos entre los dos.
