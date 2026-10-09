# CLAUDE.md

@AGENTS.md

Instrucciones para Claude Code en este repositorio. Las leen las sesiones de todos los que trabajan en el proyecto, así que todos arrancan con el mismo contexto.

## Qué es

Web gratuita para estudiantes de FIUBA que integra en una sola cuenta lo que hoy hacen FIUBA Map (correlativas y avance), FIUBA Plan (armado del cuatrimestre) y FIUBA Reviews (reseñas de cursos).

Antes de tocar algo, leé:

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

### Estructura

- `src/app/`: una carpeta por sección (`mapa`, `plan`, `resenas`, `perfil`); `page.tsx` es la página.
- `src/components/`: componentes compartidos (barra superior, contenedor de página, botón de tema).
- `src/lib/app.ts`: nombre de la app y menú. El nombre se cambia solo ahí.
- `src/app/globals.css`: **el único lugar con colores.** Variables para claro (`[data-theme="light"]`) y oscuro (`[data-theme="dark"]`) que Tailwind expone como clases: `bg-bg`, `bg-surface`, `bg-header`, `border-line`, `border-line-strong`, `text-ink`, `text-ink-2`, `text-muted`, `bg-accent`, `text-on-accent`, `bg-accent-soft`, `bg-lavender`/`text-lavender-ink`, `bg-mint`/`text-mint-ink`, `bg-butter`/`text-butter-ink`, `bg-sky`/`text-sky-ink`, `bg-peach`/`text-peach-ink`, `text-star`, `text-danger`, `bg-disabled`/`text-disabled-ink`.
- Tema: `src/lib/theme.ts`. Se guarda en `localStorage` ("claro" | "oscuro" | "sistema") y un script en `<head>` lo aplica antes de pintar.
- Tipografía: IBM Plex Sans servida desde el propio proyecto (`@fontsource/ibm-plex-sans`), sin depender de Google Fonts.

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

- `data/planes/`: los 25 planes de FIUBA Map (24 se usan). Formato y correspondencias en su README.
- `data/siu/`: oferta real de Ing. Industrial 2C 2026 (texto copiado del SIU y su versión interpretada), para tests del intérprete.
- `tools/siu-parser/`: prototipo en Python del intérprete del SIU. La versión de producción se escribe en TypeScript dentro de la app, usando este prototipo y sus datos como referencia y como casos de prueba.

## Licencias

`LICENSES/FIUBA-Map.txt` tiene que quedar en el repo mientras usemos sus datos. Si se reutiliza código de FIUBA Plan, agregar su licencia en la misma carpeta.
