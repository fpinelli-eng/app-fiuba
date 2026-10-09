import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// Rutas que se pueden ver sin sesión.
const PUBLIC_PATHS = ["/ingresar", "/auth"];

// Refresca la sesión en cada pedido y manda a /ingresar a quien no la tiene.
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

  let loggedIn = false;
  try {
    const { data } = await supabase.auth.getUser();
    loggedIn = !!data.user;
  } catch {
    loggedIn = false;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
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
