import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getCareers } from "@/lib/careers";
import { getAnnouncements, getPushCounts } from "@/lib/broadcast/data";
import { isActive } from "@/lib/broadcast/model";
import { vapidConfigured } from "@/lib/broadcast/push";
import { deleteAnnouncement } from "./actions";
import { AnnouncementForm } from "./AnnouncementForm";
import { PushForm } from "./PushForm";
import { AnnouncementList } from "./AnnouncementList";

export const metadata: Metadata = { title: `Notificaciones · Administración · ${APP_NAME}` };

// Aviso en Inicio y notificaciones push. Por ahora es una prueba de los administradores: los alumnos
// no ven el aviso ni pueden activar las notificaciones. El layout de /admin ya exige ser administrador.
export default async function AdminBroadcastPage() {
  const [careers, announcements, counts] = await Promise.all([getCareers(), getAnnouncements(), getPushCounts()]);
  const careerOptions = careers.map((c) => ({ id: c.id, name: c.shortName }));
  const now = new Date();

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-14">
      <div>
        <h1 className="text-[30px] font-semibold">Notificaciones</h1>
        <p className="text-muted">Un aviso en el Inicio y notificaciones al celular, para llegar a los alumnos sin el límite de los mails. Por ahora es una prueba: solo lo ven los administradores.</p>
      </div>

      <AnnouncementForm careers={careerOptions} />

      <AnnouncementList
        announcements={announcements?.map((a) => ({ ...a, active: isActive(a, now) })) ?? null}
        careers={careerOptions}
        onDelete={deleteAnnouncement}
      />

      <PushForm careers={careerOptions} counts={counts} configured={vapidConfigured()} />
    </main>
  );
}
