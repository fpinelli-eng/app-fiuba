import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { parseRef, REFERRAL_COOKIE, REFERRAL_MAX_AGE } from "@/lib/referral";

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
  let loggedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    loggedIn = !!data?.claims.sub;
  } catch {
    loggedIn = false;
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
