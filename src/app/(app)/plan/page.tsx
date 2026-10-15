import { getSamplePlanData } from "@/lib/plan/sample-offer";
import { PlanBuilder } from "./PlanBuilder";

export default function PlanPage() {
  // Datos de prueba hasta que la oferta esté en la base de datos (#3).
  return <PlanBuilder data={getSamplePlanData()} />;
}
