import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/app";
import { Logo } from "@/components/Logo";
import { getCareers } from "@/lib/careers";
import { requireAccount } from "@/lib/session";
import { CareerPicker } from "./CareerPicker";

export const metadata: Metadata = { title: `Tu carrera · ${APP_NAME}` };

// Paso 2 del ingreso (prototipo 01-ingreso): elegir carrera y plan.
export default async function CarreraPage() {
  const account = await requireAccount();
  if (account.planId) redirect("/");
  const careers = await getCareers();

  return (
    <>
      <header className="flex min-h-[56px] items-center justify-between gap-3 border-b border-line bg-header px-4 md:min-h-[68px] md:gap-6 md:px-8">
        <div className="flex flex-none items-center gap-3 md:flex-initial">
          <Logo className="h-[15px] md:h-[16px]" />
        </div>
        <span className="min-w-0 truncate text-[13px] text-muted md:min-w-auto md:overflow-visible md:whitespace-normal">{account.email}</span>
      </header>
      <main className="mx-auto flex max-w-[820px] flex-col gap-4 px-4 pt-6 pb-10 md:gap-[22px] md:px-6 md:pt-11 md:pb-14">
        <h1 className="text-[26px] font-semibold md:text-[30px]">¿Qué carrera estudiás?</h1>
        <CareerPicker careers={careers} />
      </main>
    </>
  );
}
