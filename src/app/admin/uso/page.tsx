import { redirect } from "next/navigation";

// Uso se juntó con Usuarios: los enlaces viejos llevan ahí.
export default function AdminUsagePage() {
  redirect("/admin/usuarios");
}
