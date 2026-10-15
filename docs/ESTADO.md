# Estado del proyecto

Resumen para que cualquier persona (o cualquier sesión de Claude) sepa en qué punto estamos sin haber estado en las conversaciones anteriores. **Se actualiza en cada pull request que cambie algo de lo que dice acá.**

Última actualización: 15 de octubre de 2026.

## Cómo se llegó hasta acá

1. **Producto** (septiembre–octubre 2026): se definió qué hace la app y por qué. Todo está en `PRODUCTO.md`, incluidas las decisiones cerradas y las abiertas.
2. **Diseño** (5–9 de octubre): se diseñaron las 13 pantallas en un lienzo de Claude Design, iterando pantalla por pantalla con Francisco. El resultado está en el repo: `docs/DISENO.md` (colores, tipografía, comportamiento) y `docs/diseno/prototipos/` (el código de cada pantalla, que es la referencia exacta).
3. **Código** (desde el 9 de octubre): proyecto base, login y las primeras piezas de lógica. Ver "Qué está hecho".

## Qué está hecho

| Qué | Dónde | Estado |
|---|---|---|
| Documento de producto | `PRODUCTO.md` | v0.5 |
| Diseño de las 13 pantallas | `docs/DISENO.md`, `docs/diseno/prototipos/` | Terminado |
| Proyecto base: Next.js 16, Tailwind 4, colores claro/oscuro, tipografía, barra superior, páginas vacías | `src/app/`, `src/components/` | En `main` (#1, PR #4) |
| Login con Google solo @fi.uba.ar, verificado en el servidor; pantalla de cuenta rechazada; perfil con cerrar sesión | `src/lib/session.ts`, `src/lib/auth.ts`, `src/lib/supabase/`, `src/proxy.ts`, `src/app/ingresar/`, `src/app/auth/` | En `main` (#2, PR #9), probado en producción |
| Intérprete del SIU en TypeScript, con pruebas | `src/lib/siu/` | En `main` (#5, PR #10) |
| Lógica del plan: cursos elegibles, superposiciones, traslados | `src/lib/plan/` | En `main` (#11, PR #12) |
| Pantalla del plan del cuatrimestre con datos de prueba (oferta real de Industrial 2C 2026), sin guardado | `src/app/(app)/plan/`, `src/lib/plan/sample-offer.ts` | En `main` (PR #14) |
| Base de datos: esquema con seguridad por fila, los 24 planes cargados, pruebas de seguridad y aplicación automática en Supabase; paso de elegir carrera y plan | `supabase/`, `tools/db-test/`, `tools/plans-seed/`, `src/app/carrera/` | En `main` (#3, PR #15) |
| Mapa de la carrera y primera carga de materias, guardando en la base | `src/lib/map/`, `src/app/(app)/mapa/` | En `main` (#17, PR #18) |
| Seguridad: leer catálogo, oferta y reseñas exige cuenta FIUBA (no alcanza con una sesión de Google); cursadas solo del propio plan | `supabase/migrations/20261015170000_member_only_reads.sql` | PR #20 abierto |

## Qué falta, en orden

1. **#3 · Base de datos (PR #15):** las migraciones ya están aplicadas en Supabase (se corrió el workflow a mano sobre la rama). GitHub entra con el secreto `SUPABASE_DB_PASSWORD` por el *session pooler* de Supabase (IPv4), sin token. Después, Francisco se marca como administrador a él y al segundo desarrollador desde el editor SQL de Supabase (es un dato, no un cambio de estructura; cada uno tiene que haber entrado a la web al menos una vez): `update profiles set is_admin = true where id in (select id from auth.users where email in ('<mail 1>', '<mail 2>'));`
2. **Colores del calendario del plan:** sumar los 2 pasteles que faltan en `globals.css` (segundo desarrollador, PR chico aparte).
3. Después de la #3, por área (ver `docs/COLABORACION.md`):
   - **Francisco:** inicio (avance, promedio, materias, calendario, finales pendientes). El mapa y la primera carga están en el PR de la #17.
   - **Segundo desarrollador:** conectar la pantalla del plan a la base (hoy usa `src/lib/plan/sample-offer.ts`), filtrar por materias habilitadas y guardar Opción A / B en su propia migración.
   - **Después, a repartir:** reseñas (buscador, ficha, pendientes, filtro de comentarios), administración (carga de la oferta del SIU por plan, moderación), perfil completo.
4. **#8 · Política de privacidad** y publicación de la app en Google (antes del lanzamiento).
5. Abiertas en `PRODUCTO.md` (sección 13): nombre y dominio, plan 2014 de Sistemas, equivalencias entre planes.

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
| Vercel | Publica la web; una vista previa por pull request | Francisco (plan gratuito) | No es miembro. Las vistas previas piden iniciar sesión en Vercel; si hace falta que las vea, Francisco desactiva *Deployment Protection* |
| Supabase | Base de datos y login (plan gratuito: el proyecto se pausa tras una semana sin uso; se reactiva con *Restore project*) | Francisco | Ninguno. Las migraciones van en el repo y GitHub las aplica solo al integrarse a `main` (workflow "Base de datos") |
| Google Cloud | Credenciales de "Ingresar con Google" | Francisco | Ninguno. Para entrar a la app mientras está en modo prueba, su mail @fi.uba.ar tiene que estar en *Test users* |

**Variables de entorno:** las dos de `.env.example` (URL y publishable key de Supabase) son públicas por diseño, pero no se suben al repo: Francisco las pasa por mensaje privado. La contraseña de la base, el *client secret* de Google y la *secret key* de Supabase **nunca** se comparten ni se suben.

## Cómo trabajar con Claude en este proyecto

- **Usá Claude Code sobre el repo**, no un chat suelto: así lee `CLAUDE.md` y estos documentos solo.
- **Antes de empezar:** `git switch main && git pull`, para tener lo último.
- **La fuente de verdad es el repo.** No hace falta subir archivos del diseño a Claude: está todo en `docs/`. Las copias sueltas (PDF, zip) son solo respaldo y pueden quedar viejas.
- Si Claude necesita decidir algo que los documentos no resuelven, lo anota en el Issue y lo decidimos entre los dos.
