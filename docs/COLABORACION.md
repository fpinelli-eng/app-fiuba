# Cómo trabajamos

Somos dos, cada uno desde su casa y con su propio Claude Code. Estas reglas evitan que nos pisemos.

## Flujo de una tarea

1. **Toda tarea es un Issue** en GitHub, con un responsable asignado. Si no hay Issue, no se empieza.
2. **Una rama por Issue**, creada desde `main` actualizado: `git switch main && git pull && git switch -c mapa-ficha-materia`.
3. **Commits chicos** con mensajes claros, en inglés.
4. **Pull request** cuando la tarea está lista. En la descripción: qué cambia y cómo probarlo. Vercel genera una URL de vista previa.
5. **El otro lo revisa** (o le pide a Claude Code que lo revise) y lo aprueba. Recién ahí se integra a `main`.
6. Se borra la rama y se cierra el Issue.

`main` está protegida: no se puede subir nada directo, todo entra por pull request.

El repositorio es público: Vercel solo publica vistas previas de varios colaboradores gratis en repos públicos. Por eso es todavía más importante que no haya claves en el repo.

## Para no pisarnos

- **Dividir por áreas, no por archivos.** Cada uno tiene sus pantallas:
  - Francisco: mapa, carga de materias, planes de estudio.
  - Segundo desarrollador: plan del cuatrimestre, intérprete del SIU (su primera tarea puede arrancar ya: no depende del login ni de la base de datos).
  - Reseñas y administración: se reparten cuando lleguemos.
- **La base común la hace uno solo y antes de dividirse:** estructura de Next.js, login, esquema de base de datos, colores y componentes compartidos (botones, tarjetas, barra superior).
- **Si tenés que tocar algo compartido** (un componente común, el esquema de la base), avisá antes y hacelo en un pull request separado y chico.
- **Antes de abrir un pull request, actualizá tu rama** con lo último de `main`. Si hay conflictos, Claude Code los resuelve; revisá que el resultado tenga sentido.

## Base de datos

- Un proyecto de Supabase compartido para desarrollo.
- Todo cambio de estructura es una migración en `supabase/migrations`, dentro del pull request que la necesita.
- Las claves van en `.env.local` (no se sube). Se pasan por mensaje privado, nunca por el repo ni por un Issue.

## Decisiones de producto

Si al programar aparece algo que `PRODUCTO.md` no resuelve, no lo decide Claude solo: se anota en el Issue y lo decidimos entre los dos. Después se actualiza `PRODUCTO.md` en el mismo pull request.
