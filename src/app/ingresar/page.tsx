import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ColumnIntro } from "@/components/ColumnIntro";
import { LoginButton } from "@/components/LoginButton";
import { Logo } from "@/components/Logo";
import { APP_NAME } from "@/lib/app";
import { isAllowedEmail } from "@/lib/auth";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Presentación (docs/DISENO.md, Presentación; diseño aprobado por Francisco el 10 de noviembre de 2026).
// Es lo que ve en la raíz quien no tiene sesión (el proxy la muestra en "/" sin cambiar la dirección) y la
// página que indexan los buscadores: por eso el nombre va como texto real en el h1 y la dirección canónica es "/".

const TITLE = `${APP_NAME} · Tu carrera de ingeniería en un solo lugar`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  // Defining openGraph here replaces the root one (shallow merge), so it repeats the shared fields and the image.
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "es_AR",
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "FIUBI: tu carrera de ingeniería en un solo lugar" }],
  },
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const FEATURES: { title: string; text: string; chip: string; icon: ReactNode }[] = [
  {
    title: "Mapa",
    text: "Correlativas, avance y promedio de tu plan.",
    chip: "bg-lavender text-lavender-ink",
    icon: (
      <>
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="12" r="2.2" />
        <path d="M7.2 6.6 16.8 11.4M7.2 17.4 16.8 12.6" />
      </>
    ),
  },
  {
    title: "Plan",
    text: "Armá tu cuatrimestre con la oferta real del SIU.",
    chip: "bg-mint text-mint-ink",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="3" />
        <path d="M3.5 10h17M8.5 3v4M15.5 3v4M8 14h3M13 14h3M8 17h3" />
      </>
    ),
  },
  {
    title: "Reseñas",
    text: "Opiniones anónimas de cada curso.",
    chip: "bg-butter text-butter-ink",
    icon: <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  },
  {
    title: "Finales y fechas",
    text: "Mesas de examen y fechas de la facultad.",
    chip: "bg-peach text-peach-ink",
    icon: (
      <>
        <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </>
    ),
  },
];

// Le dice a los buscadores cómo se llama el sitio (el nombre que muestran arriba del resultado).
const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: APP_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "es-AR",
});

export default async function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const email = typeof params.email === "string" ? params.email : "";

  // Si ya tiene una sesión válida, va directo al inicio.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user && isAllowedEmail(data.user.email)) redirect("/");

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-11 px-4 pt-10 pb-7 md:gap-[72px] md:px-8 md:pt-14 md:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }} />
      <main className="flex flex-col items-center gap-11 md:gap-[72px]">
        <section className="flex flex-col items-center gap-3.5 text-center md:gap-[18px]">
          <ColumnIntro className="size-24 rounded-[22px] md:size-28 md:rounded-[26px]" />
          <h1 className="mt-1 md:mt-1.5">
            <span className="sr-only">{APP_NAME}</span>
            <Logo tone="soft" decorative className="h-11 md:h-14" />
          </h1>
          <p className="text-[20px] leading-snug font-medium md:text-2xl">Tu carrera de ingeniería en un solo lugar</p>
          <p className="max-w-[32em] text-[15px] leading-relaxed text-muted md:text-[17px]">{SITE_DESCRIPTION}</p>

          <LoginButton
            label={error ? "Probar con otra cuenta" : "Ingresar con tu cuenta @fi.uba.ar"}
            className="mt-2 h-[54px] w-full md:h-14 md:w-auto md:px-[26px] md:text-[17px]"
          />

          {error === "dominio" && (
            <div role="alert" className="mt-1 w-full max-w-[360px] rounded-xl bg-peach px-4 py-3.5 text-left text-sm text-peach-ink">
              <div className="font-semibold break-words">{email ? `${email} no es una cuenta de FIUBA` : "Esa cuenta no es de FIUBA"}</div>
              <div className="mt-0.5">Ingresá con tu mail @fi.uba.ar.</div>
            </div>
          )}
          {error === "login" && (
            <div role="alert" className="mt-1 w-full max-w-[360px] rounded-xl bg-peach px-4 py-3.5 text-left text-sm text-peach-ink">
              <div className="font-semibold">No pudimos iniciar tu sesión</div>
              <div className="mt-0.5">Probá de nuevo en un momento.</div>
            </div>
          )}
        </section>

        <ul className="grid w-full grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(210px,1fr))] md:gap-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 md:p-[22px]">
              <div className={`flex size-[42px] items-center justify-center rounded-xl ${f.chip}`}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...stroke}>
                  {f.icon}
                </svg>
              </div>
              <h2 className="text-base font-semibold md:text-lg">{f.title}</h2>
              <p className="text-[13px] leading-normal text-muted md:text-[15px]">{f.text}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="text-center text-xs text-muted md:text-[13px]">
        Hecho por estudiantes. No es un sitio oficial de la FIUBA. ·{" "}
        <Link href="/privacidad" className="inline-block px-0.5 py-2.5 underline">
          Privacidad
        </Link>
      </footer>
    </div>
  );
}
