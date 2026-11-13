# Seguridad

Revisión del 10 de noviembre de 2026, antes del lanzamiento oficial. Se actualiza cuando se resuelve un punto o aparece uno nuevo.

## Qué está bien

- **Base de datos.** Revisada aplicando todas las migraciones a una base vacía:
  - todas las tablas tienen seguridad por fila;
  - nada está abierto a usuarios sin sesión (`anon`) y ninguna política es `true`. La excepción son las funciones del Apps Script de los recordatorios (`avisos_pendientes()`, `avisos_marcar_enviado()`, `avisos_confirmaciones()` y `avisos_confirmacion_enviada()`) y del monitor (`salud()`, que devuelve solo cantidades y fechas), que sin su token devuelven error (la base guarda solo el SHA-256 del token, en una tabla que nadie lee);
  - las funciones con permisos elevados (`security definer`) fijan `search_path` y verifican quién llama;
  - `profiles.is_admin` no se puede cambiar desde la app (permisos por columna) y el plan solo con `choose_my_plan()` (la primera vez) o `change_my_plan()`;
  - el autor de una reseña (`review_authors`) no lo puede leer ningún usuario.
- **Login.** El dominio @fi.uba.ar se verifica en el servidor tres veces: al volver de Google, en cada página (`requireAccount()`) y en la base (`ensure_profile()`, sin perfil no se lee nada).
- **Acciones del servidor.** Todas verifican la sesión (y las de Administración, que sea administrador) antes de tocar la base, y la base lo vuelve a verificar.
- **Sin secretos en el repo ni en la web.** La app solo usa la clave pública de Supabase; la *secret key* no está en ningún lado del código.
- **Enlaces y contenido.** Los avisos solo aceptan enlaces `http(s)`, los enlaces externos llevan `rel="noopener noreferrer"` y no se inserta HTML de usuarios.
- **Descarga de fechas de examen.** Solo desde el host y la ruta del SIU, sin seguir redirecciones y con 15 s de límite.

## Resuelto en esta revisión

| Qué | Por qué | Dónde |
|---|---|---|
| Next.js 16.3.8 → 16.4.6 | Tenía tres vulnerabilidades publicadas el 14 de octubre de 2026. La que nos afecta: con pedidos armados a mano contra una server action se podía trabar el servidor (denegación de servicio). Las otras dos (críticas) requieren `next/image` o `use cache`, que la app no usa, pero se corrigen igual | `package.json` |
| Cabeceras de seguridad | Antes no había ninguna. Ahora nadie puede meter la app dentro de otra página para engañar clics (`frame-ancestors 'none'`), el navegador no adivina tipos de archivo, los enlaces externos no llevan la dirección completa, se fuerza HTTPS y la web no pide cámara, micrófono ni ubicación | `next.config.ts` |
| Carrera y plan solo por la app | Un alumno podía cambiar `profiles.plan_id` directo por la API y saltear la limpieza de `change_my_plan()` (quedaban materias de un plan en otro). Ahora la primera elección pasa por `choose_my_plan()` (solo si todavía no tiene plan) y los cambios, por `change_my_plan()` | `supabase/migrations/20261113120000_plan_only_by_function.sql`, `src/app/carrera/actions.ts` |
| Texto de la dirección en la página principal | El mail rechazado viajaba en la dirección (`?error=dominio&email=…`) y la presentación lo mostraba: cualquiera podía armar un enlace a fiubi.com.ar con el texto que quisiera (phishing). Ahora el mail no viaja y cada motivo muestra un texto fijo | `src/app/ingresar/page.tsx`, `src/app/auth/`, `src/lib/session.ts`, `src/lib/auth.ts` |
| Relevamiento de usuarios sin desglose | El resumen del workflow es público (repo público) y con pocos usuarios las altas por día y por carrera podían señalar a alguien. Quedan solo los totales; el detalle está en Administración → Usuarios | `tools/stats/users.sql` |
| "Descargar mis datos" completo | Faltaban la fecha de alta, las historias vistas, la Opción A / B del Plan y las ofertas enviadas | `src/app/(app)/perfil/datos/route.ts` |

## Pendiente antes del lanzamiento

Ordenado por importancia. Lo que dice **(Francisco)** se hace desde los paneles; no necesita código.

1. **Verificación en dos pasos (Francisco y Jantus).** El ataque más probable no es contra el código sino contra las cuentas: quien entra a tu GitHub, Vercel, Supabase o Google Cloud tiene la app entera. Activar la verificación en dos pasos (con app de autenticación o llave, no SMS) en las cuatro cuentas, y que Jantus la active en su GitHub.
2. **Supabase → Authentication → Sign In / Providers (Francisco):** dejar habilitado **solo Google**. Si Email, Phone o *Anonymous sign-ins* están activos, alguien podría crear una sesión por la API sin pasar por Google. Hoy eso no le da acceso a nada (la base exige un mail @fi.uba.ar), pero no hay razón para dejar la puerta.
3. **GitHub → Settings → Code security (en algunas cuentas se llama *Advanced Security*) (Francisco):** activar *Dependabot alerts*, *Dependabot security updates*, *Secret scanning* y *Push protection*. Son gratis en repos públicos: Dependabot habría avisado solo de la vulnerabilidad de Next.js, y *push protection* frena un commit que traiga una clave por error.
4. **GitHub → Settings → Branches → regla de `main` (Francisco):** exigir que pasen los chequeos antes de integrar (*Require status checks to pass*: "Base de datos" y Vercel). Hoy se puede integrar un PR con las pruebas de la base en rojo.
5. **Supabase → Advisors → Security Advisor (Francisco):** correrlo y revisar si marca algo que no se ve desde el repo (por ejemplo, configuración del login).
6. **Reseñas: hora exacta.** La base le devuelve a cualquier alumno la fecha y hora exacta de cada reseña (`created_at`). Con pocas reseñas en un curso, alguien que sabe cuándo escribió un amigo podría adivinar cuál es la suya. Propuesta: que solo se pueda leer el mes. Necesita una migración.
7. **Vistas previas y base compartida.** Las vistas previas de Vercel usan la misma base que producción y no piden sesión de Vercel. Las protege el login de la app, pero un PR con un error puede romper datos reales. Para más adelante: un segundo proyecto de Supabase (el plan gratuito permite dos) solo para las vistas previas.
8. **Redirect URL de `localhost` (Francisco):** cuando Jantus ya no necesite probar contra la base real, sacar `http://localhost:3000/**` de Supabase → Authentication → URL Configuration.
9. **Respaldos:** probar una vez restaurar el respaldo semanal en una base vacía (`docs/RESPALDOS.md`), así se sabe que sirve antes de necesitarlo.

## Caídas y límites (planes gratuitos)

- **Vercel Hobby:** sin costo sorpresa, pero tiene límites de uso por mes; si se pasan, Vercel puede pausar el proyecto hasta que se renueve el período. *Firewall → Attack Challenge Mode* sirve para frenar un ataque de tráfico en el momento.
- **Supabase gratis:** 500 MB de base y 50.000 usuarios activos por mes (de sobra para FIUBA). Se pausa tras una semana sin uso (lo evita `keepalive.yml`) y no tiene respaldos descargables (por eso `backup.yml`).
- Ver el consumo de los dos una vez por mes después del lanzamiento.

## Repositorio público o privado

Hoy es público porque Vercel gratis solo publica commits de colaboradores en repos públicos. Pasarlo a privado sin pagar tiene costos:

- **Vercel Hobby no despliega commits de otro autor en un repo privado.** Las vistas previas de los PRs de Jantus dejarían de funcionar, y si Jantus integra un PR, producción no se actualiza (el commit de integración es suyo).
- **La protección de `main` deja de aplicarse** en repos privados de cuentas gratuitas de GitHub. GitHub Pro la habilita y es gratis para estudiantes con el GitHub Student Developer Pack.
- **GitHub Actions pasa a tener un tope mensual** (hoy es ilimitado). Los workflows actuales deberían entrar sin problema.

Lo que expone hoy el repo público: el código (sin secretos), el identificador del proyecto de Supabase (también visible en la web), los resúmenes del workflow "Relevamiento de usuarios" (solo totales generales, sin desglose por carrera ni por día: con pocos usuarios podían señalar a alguien) y los respaldos cifrados (sin la frase `BACKUP_PASSPHRASE` no se pueden abrir).
