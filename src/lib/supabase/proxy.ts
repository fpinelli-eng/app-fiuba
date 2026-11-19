import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { parseRef, REFERRAL_COOKIE, REFERRAL_MAX_AGE } from "@/lib/referral";

// Cookie de "ya anotamos que usaste la app en la última hora" (ver touch_last_seen más abajo).
const SEEN_COOKIE = "fiubi_seen";
const SEEN_MAX_AGE = 60 * 60; // 1 hora, en segundos
// touch_last_seen() todavía no está en la base (las vistas previas de Vercel usan la de producción).
const MISSING_FUNCTION = new Set(["42883", "PGRST202"]);

// Rutas que se pueden ver sin sesión.
const PUBLIC_PATHS = ["/ingresar", "/auth", "/privacidad", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"];

// Refresca la sesión en cada pedido y manda a /ingresar a quien no la tiene. En la raíz, sin sesión, se ve
// la presentación (la página de /ingresar) sin cambiar la dirección: es la página que indexan los buscadores.
// Es un control rápido: la verificación definitiva (incluido el dominio) está en el layout de (app).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims verifica la firma del token en el servidor, sin ir a Supabase cuando el proyecto
  // usa claves asimétricas (si no, consulta a Supabase como getUser). También renueva el token vencido.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims.sub ?? null;
  } catch {
    userId = null;
  }
  const loggedIn = !!userId;

  // "Activos" en Administración: profiles.last_seen_at se anota como mucho una vez por hora por alumno.
  // La cookie fiubi_seen (con el id, por si cambia la cuenta en el navegador) evita llamar a la base en
  // cada página: sin ella serían una escritura o un intento por cada vista. Va antes de la cookie del QR
  // porque las cookies de `response` se copian a las redirecciones de abajo.
  if (userId && request.cookies.get(SEEN_COOKIE)?.value !== userId) {
    const { error } = await supabase.rpc("touch_last_seen");
    // Si la base falla, se reintenta en 5 minutos y no en cada pedido.
    const maxAge = error && !MISSING_FUNCTION.has(error.code) ? 5 * 60 : SEEN_MAX_AGE;
    response.cookies.set(SEEN_COOKIE, userId, { httpOnly: true, sameSite: "lax", secure: true, maxAge, path: "/" });
  }

  // Llegó por el QR impreso (?ref=qr): se recuerda en una cookie propia hasta que cree la cuenta
  // (requireAccount() lo guarda en profiles.signup_source). Solo valores de la lista, nunca texto libre.
  // Va después de getClaims porque setAll reemplaza `response`; las respuestas de abajo copian sus cookies.
  const ref = parseRef(request.nextUrl.searchParams.get("ref"));
  if (ref && !loggedIn) {
    response.cookies.set(REFERRAL_COOKIE, ref, { httpOnly: true, sameSite: "lax", secure: true, maxAge: REFERRAL_MAX_AGE, path: "/" });
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (!loggedIn && path === "/") {
    const rewrite = NextResponse.rewrite(new URL(`/ingresar${request.nextUrl.search}`, request.url));
    response.cookies.getAll().forEach((c) => rewrite.cookies.set(c));
    return rewrite;
  }
  if (!loggedIn && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/ingresar";
    to.search = "";
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
