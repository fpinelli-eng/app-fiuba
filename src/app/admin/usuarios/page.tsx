import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { checkSite, getAdminOverview, getDeployments } from "@/lib/admin/usage-data";
import { UsersView } from "./UsersView";

export const metadata: Metadata = { title: `Usuarios · Administración · ${APP_NAME}` };

// Usuarios (antes Usuarios y Uso): cuántos usan la app, de qué carrera, cuánto ocupa la base, cómo
// responde el servidor y la lista de alumnos. Una sola llamada a la base (admin_uso()), en paralelo con
// el chequeo del sitio y de Vercel. El layout de /admin ya exige ser administrador y la función de la
// base lo vuelve a controlar. De las reseñas se muestra solo el total de alumnos que dejaron alguna,
// nunca por alumno: con el número de cada uno se podía saber quién escribió cada reseña.
export default async function AdminUsersPage() {
  const [overview, site, deployments] = await Promise.all([getAdminOverview(), checkSite(), getDeployments()]);
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
      now={now}
    />
  );
}
