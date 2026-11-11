import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

// Google devuelve acá al alumno con un código de un solo uso; lo canjeamos por la sesión.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/ingresar?error=login`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/ingresar?error=login`);

  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/ingresar?error=dominio`);
  }
  return NextResponse.redirect(`${origin}/`);
}
