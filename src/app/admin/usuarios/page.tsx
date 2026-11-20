import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getCareers } from "@/lib/careers";
import { checkSite, getAdminOverview, getDeployments } from "@/lib/admin/usage-data";
import { UsersView } from "./UsersView";

export const metadata: Metadata = { title: `Usuarios · Administración · ${APP_NAME}` };

// Usuarios (antes Usuarios y Uso): cuántos usan la app, de qué carrera, cuánto ocupa la base, cómo
// responde el servidor y la lista de alumnos por carrera. Una sola llamada a la base (admin_uso()), en
// paralelo con el chequeo del sitio y de Vercel. "En línea ahora" viene de Supabase Realtime Presence
// (LiveOnline), no de la base. El layout de /admin ya exige ser administrador y la función de la base
// lo vuelve a controlar. De las reseñas se muestra solo el total de alumnos que dejaron alguna, nunca
// por alumno ni por carrera: en una carrera chica, el número ya diría quién escribió.
export default async function AdminUsersPage() {
  // Las carreras salen del caché compartido del catálogo (no suman lecturas a la base en cada visita).
  const [overview, site, deployments, careers] = await Promise.all([getAdminOverview(), checkSite(), getDeployments(), getCareers()]);
  // The database clock when there is one, the same one the dates come from.
  const now = overview.usage ? Date.parse(overview.usage.checkedAt) : overview.readAt;
  return (
    <UsersView
      usage={overview.usage}
      users={overview.users}
      reviewAuthors={overview.reviewAuthors}
      dbMs={overview.dbMs}
      site={site}
      deployments={deployments}
      careers={careers}
      now={now}
    />
  );
}
