import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/app";
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
      <header className="flex min-h-[68px] items-center justify-between gap-6 border-b border-line bg-header px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-[30px] place-items-center rounded-lg bg-lavender text-sm font-bold text-lavender-ink">
            F
          </span>
          <span className="font-bold tracking-[0.02em]">{APP_NAME}</span>
        </div>
        <span className="text-[13px] text-muted">{account.email}</span>
      </header>
      <main className="mx-auto flex max-w-[820px] flex-col gap-[22px] px-6 pt-11 pb-14">
        <h1 className="text-[30px] font-semibold">¿Qué carrera estudiás?</h1>
        <CareerPicker careers={careers} />
      </main>
    </>
  );
}
