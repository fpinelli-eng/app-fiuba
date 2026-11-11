import { NextResponse, type NextRequest } from "next/server";
import { loginError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Cierra la sesión. Con ?error=dominio vuelve al ingreso mostrando el rechazo; solo pasa motivos
// conocidos y nada más de la dirección.
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const to = new URL("/ingresar", request.nextUrl.origin);
  const error = loginError(request.nextUrl.searchParams.get("error"));
  if (error) to.searchParams.set("error", error);
  return NextResponse.redirect(to, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;
