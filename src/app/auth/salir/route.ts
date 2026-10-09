import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cierra la sesión. Con ?error=dominio&email=… vuelve al ingreso mostrando el rechazo.
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const to = new URL("/ingresar", request.nextUrl.origin);
  const error = request.nextUrl.searchParams.get("error");
  const email = request.nextUrl.searchParams.get("email");
  if (error) to.searchParams.set("error", error);
  if (email) to.searchParams.set("email", email);
  return NextResponse.redirect(to, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;
