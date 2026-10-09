import { PageShell, Pending } from "@/components/PageShell";
import { requireProfile } from "@/lib/session";

export default async function InicioPage() {
  const profile = await requireProfile();
  return (
    <PageShell title={`Hola, ${profile.firstName}`}>
      <Pending issue="panel de avance" />
    </PageShell>
  );
}
