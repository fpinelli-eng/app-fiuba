import { PageShell, Pending } from "@/components/PageShell";
import { Avatar } from "@/components/Avatar";
import { requireProfile } from "@/lib/session";

export default async function PerfilPage() {
  const profile = await requireProfile();
  return (
    <PageShell title="Tu perfil">
      <section className="flex items-center gap-[18px]">
        <Avatar profile={profile} size={84} />
        <div className="min-w-0 flex-1">
          <div className="text-[30px] leading-tight font-semibold">{profile.fullName}</div>
          <div className="text-muted">{profile.email}</div>
        </div>
        <form action="/auth/salir" method="post">
          <button
            type="submit"
            className="h-10 cursor-pointer rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold"
          >
            Cerrar sesión
          </button>
        </form>
      </section>
      <Pending issue="carrera, apariencia, mis reseñas y tus datos" />
    </PageShell>
  );
}
