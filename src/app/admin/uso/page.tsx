import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { checkSite, getDeployments, getUsage } from "@/lib/admin/usage-data";
import { UsageView } from "./UsageView";

export const metadata: Metadata = { title: `Uso · Administración · ${APP_NAME}` };

// Uso: cuántos alumnos usan la app, cuántos a la vez, de qué carrera, cuánto ocupa la base y cómo
// responde el servidor. Todo se calcula al abrir la página (una llamada a la base, en paralelo con el
// chequeo del sitio y de Vercel): no hay trabajos programados. Solo números, nunca mails ni nombres.
// El layout de /admin ya exige ser administrador y la función de la base lo vuelve a controlar.
export default async function AdminUsagePage() {
  const [{ usage, dbMs, readAt }, site, deployments] = await Promise.all([getUsage(), checkSite(), getDeployments()]);
  // The database clock when there is one, the same one the dates come from.
  const now = usage ? Date.parse(usage.checkedAt) : readAt;
  return <UsageView usage={usage} dbMs={dbMs} site={site} deployments={deployments} now={now} />;
}
