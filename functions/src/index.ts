import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";

initializeApp();

setGlobalOptions({
  maxInstances: 10,
});

export { importFileFromStorage } from "./importFileFromStorage.js";
export { rebuildEverything } from "./rebuildEverything.js";
export { cleanDatabase } from "./cleanDatabase.js";
export { softResetReports } from "./softResetReports.js";
export { reprocessImportJob } from "./reprocessImportJob.js";
export { rebuildReportsAnalytics } from "./rebuildReportsAnalytics";
export { updatePatientIndexFromRows } from "./patientIndex";
export { importOrdersFromStorage } from "./importOrdersFromStorage";