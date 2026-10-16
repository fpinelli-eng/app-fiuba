import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/app";

export const metadata: Metadata = { title: `Política de privacidad · ${APP_NAME}` };

// Política de privacidad (issue #8). Pública: Google la pide para publicar el login.
// Si cambia qué datos se guardan o dónde, se actualiza este texto y la fecha.
const UPDATED = "16 de octubre de 2026";

export default function PrivacidadPage() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent underline">
      {CONTACT_EMAIL}
    </a>
  );

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-7 px-6 pt-14 pb-16">
      <div>
        <Link href="/" className="text-sm font-semibold text-muted">
          ← {APP_NAME}
        </Link>
        <h1 className="mt-3 text-[34px] leading-tight font-semibold tracking-[-0.01em]">Política de privacidad</h1>
        <div className="mt-1 text-sm text-muted">Última actualización: {UPDATED}</div>
      </div>

      <Section title="Quiénes somos">
        <p>
          {APP_NAME} es una web gratuita hecha por estudiantes de la Facultad de Ingeniería de la UBA para seguir la carrera, armar el cuatrimestre y reseñar cursos. No es un sitio
          oficial de la universidad. Los responsables de tus datos son los administradores del proyecto. Para cualquier consulta, escribinos a {mail}.
        </p>
      </Section>

      <Section title="Qué datos guardamos">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <b>De tu cuenta de Google @fi.uba.ar:</b> nombre, mail y foto. Los usamos para identificarte y mostrarlos en tu perfil. No accedemos a tus mails, archivos ni a
            nada más de tu cuenta.
          </li>
          <li>
            <b>Lo que cargás:</b> tu carrera y plan, el estado y la nota de cada materia, los requisitos aprobados (como la prueba de inglés) y los cursos que elegís para el
            cuatrimestre.
          </li>
          <li>
            <b>Tus reseñas:</b> las estrellas y el comentario de cada curso que reseñás.
          </li>
          <li>
            <b>En tu navegador:</b> una cookie para mantener tu sesión iniciada y tu preferencia de tema (claro u oscuro).
          </li>
        </ul>
        <p>No hay publicidad ni herramientas de seguimiento de terceros. No vendemos ni compartimos tus datos.</p>
      </Section>

      <Section title="Reseñas anónimas">
        <p>
          Las reseñas se publican sin tu nombre. Ningún alumno ni pantalla de la web, tampoco las de administración, puede ver quién escribió cada una. La relación entre la
          reseña y tu cuenta queda guardada aparte, solo para que no reseñes dos veces el mismo curso y puedas editar la tuya.
        </p>
        <p>Si borrás tu cuenta, esa relación se borra y la reseña queda publicada sin autor. Los administradores pueden eliminar reseñas fuera de lugar o destacarlas.</p>
      </Section>

      <Section title="Dónde se guardan">
        <p>
          La base de datos y el inicio de sesión están en Supabase, y la web en Vercel, con servidores en San Pablo, Brasil. El inicio de sesión se hace con Google, que solo
          nos informa tu nombre, mail y foto.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Podés acceder a tus datos, corregirlos y borrarlos cuando quieras (Ley 25.326 de Protección de Datos Personales). Desde tu perfil podés <b>descargar tus datos</b> y{" "}
          <b>borrar tu cuenta</b>, que elimina todo lo tuyo salvo las reseñas, que quedan sin autor. Tus materias las corregís en el mapa. Para cualquier otro pedido,
          escribinos a {mail}.
        </p>
        <p>Guardamos tus datos mientras tengas la cuenta. Si cambia algo importante de esta política, lo vas a ver en la web antes de que rija.</p>
      </Section>

      <p className="rounded-[14px] border border-line bg-surface px-5 py-4 text-[13px] leading-relaxed text-muted">
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a ellos en forma gratuita a intervalos no inferiores a seis meses, salvo que se
        acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley N.º 25.326. La Agencia de Acceso a la Información Pública, en su
        carácter de órgano de control de la Ley N.º 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos
        por incumplimiento de las normas vigentes en materia de protección de datos personales.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-ink-2">
      <h2 className="text-[20px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
