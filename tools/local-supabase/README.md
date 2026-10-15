# Supabase local para pruebas

Una copia de la base en tu computadora para probar la app de punta a punta (con sesión, lecturas y guardado) sin tocar el proyecto real de Supabase. Pensado sobre todo para que Claude pruebe una pantalla con un navegador automático (Playwright) antes de abrir un pull request.

Qué levanta:
- La base con todas las migraciones y un usuario de prueba (`prueba@fi.uba.ar`, sin carrera elegida).
- [PostgREST](https://postgrest.org), el mismo motor que usa Supabase para la API (se descarga solo la primera vez).
- `gateway.mjs`: imita las direcciones de Supabase que usa la app (`/rest/v1` y `/auth/v1/user`).

No incluye el login con Google: la sesión del usuario de prueba se pone a mano como cookie.

## Uso

Necesita PostgreSQL local (las mismas variables `PG*` que `npm run db:test`).

```bash
tools/local-supabase/start.sh
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local npm run dev
```

`start.sh` imprime la cookie de sesión (`node tools/local-supabase/gateway.mjs cookie`). Con Playwright: `context.addCookies([cookie])` y después abrir `http://localhost:3000`.

Cada vez que se corre, la base se crea de cero.
