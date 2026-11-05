import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/app";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/LoginButton";

// Mosaico decorativo con los colores de los estados del mapa (prototipo 01-ingreso).
const TILES = [
  { l: 0, t: 40, h: 52, c: "bg-mint" },
  { l: 0, t: 104, h: 52, c: "bg-mint" },
  { l: 82, t: 12, h: 52, c: "bg-mint" },
  { l: 82, t: 76, h: 52, c: "bg-butter" },
  { l: 164, t: 0, h: 52, c: "bg-sky" },
  { l: 164, t: 64, h: 52, c: "bg-lavender" },
  { l: 164, t: 128, h: 40, c: "bg-peach" },
  { l: 246, t: 30, h: 52, c: "bg-surface border-[1.5px] border-enabled-line" },
  { l: 246, t: 94, h: 52, c: "bg-sky" },
  { l: 328, t: 54, h: 52, c: "bg-blocked border border-dashed border-blocked-line" },
];

export default async function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const email = typeof params.email === "string" ? params.email : "";

  // Si ya tiene una sesión válida, va directo al inicio.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user && isAllowedEmail(data.user.email)) redirect("/");

  return (
    <main className="flex flex-col items-center px-4 pt-14 pb-10 text-center md:px-6 md:pt-[120px] md:pb-20">
      {/* El mosaico mide 392 px: en el celular se achica sin cambiar las posiciones. */}
      <div aria-hidden="true" className="relative mb-8 h-[168px] w-[392px] origin-top scale-[0.8] md:mb-11 md:scale-100">
        {TILES.map((t, i) => (
          <div
            key={i}
            className={`absolute box-border w-16 rounded-xl ${t.c}`}
            style={{ left: t.l, top: t.t, height: t.h }}
          />
        ))}
      </div>
      <h1 className="text-[56px] leading-none font-bold tracking-[-0.035em] break-words md:text-[88px]">{APP_NAME}</h1>
      <p className="mt-3 text-[18px] text-muted md:mt-[18px] md:text-[22px]">Tu carrera de FIUBA en un solo lugar</p>

      <LoginButton label={error ? "Probar con otra cuenta" : "Ingresar con tu cuenta @fi.uba.ar"} />

      {error === "dominio" && (
        <div role="alert" className="mt-5 w-full max-w-[360px] rounded-xl bg-peach px-4 py-3.5 text-left text-sm text-peach-ink">
          <div className="font-semibold break-words">{email ? `${email} no es una cuenta de FIUBA` : "Esa cuenta no es de FIUBA"}</div>
          <div className="mt-0.5">Ingresá con tu mail @fi.uba.ar.</div>
        </div>
      )}
      {error === "login" && (
        <div role="alert" className="mt-5 w-full max-w-[360px] rounded-xl bg-peach px-4 py-3.5 text-left text-sm text-peach-ink">
          <div className="font-semibold">No pudimos iniciar tu sesión</div>
          <div className="mt-0.5">Probá de nuevo en un momento.</div>
        </div>
      )}

      <footer className="mt-16 text-[13px] text-muted md:mt-24">
        Hecho por estudiantes. No es un sitio oficial de la universidad. ·{" "}
        <Link href="/privacidad" className="inline-block py-2 underline md:inline md:py-0">
          Privacidad
        </Link>
      </footer>
    </main>
  );
}
