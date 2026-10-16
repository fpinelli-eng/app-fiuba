import { getPlanData } from "@/lib/plan/data";
import { requireProfile } from "@/lib/session";
import { PlanBuilder } from "./PlanBuilder";

export default async function PlanPage() {
  const account = await requireProfile();
  return <PlanBuilder data={await getPlanData(account.id, account.planId!)} />;
}
