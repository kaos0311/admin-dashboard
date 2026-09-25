import { updateHospiceAnalytics } from "./updateHospiceAnalytics";
import { updateOrderAnalytics } from "./updateOrderAnalytics";
import { updatePatientAnalytics } from "./updatePatientAnalytics";

export async function rebuildAnalytics(): Promise<void> {
  await updatePatientAnalytics();
  await updateOrderAnalytics();
  await updateHospiceAnalytics();
}
