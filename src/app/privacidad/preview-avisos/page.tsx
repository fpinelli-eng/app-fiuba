import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { PreviewAvisos } from "./PreviewAvisos";

// VISTA PREVIA TEMPORAL, SE BORRA ANTES DE INTEGRAR: el aviso del Inicio, "Notificaciones" de Perfil y
// los formularios de Administración con datos inventados, para verlos sin iniciar sesión. Nada se guarda.
export const metadata: Metadata = {
  title: `Vista previa: aviso y notificaciones · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function PreviewAvisosPage() {
  return <PreviewAvisos />;
}
