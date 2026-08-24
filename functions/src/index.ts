import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

// User management
export { createDashboardUser } from "./adminUsers";

// Core app functions
export { askAdminAi } from "./ai/callable/askAdminAi";
export { scanDatabasePhiSafety } from "./ai/callable/scanDatabasePhiSafety";
export { screenImportJobWithJarvis } from "./ai/callable/screenImportJobWithJarvis";

// Import pipeline
export { importFileFromStorage } from "./imports/importFileFromStorage";
export { processImportWorkerQueue } from "./imports/workers/processImportWorkerQueue";
export { scheduledImportCleanup } from "./imports/cleanup/scheduledMaintenance";
export { reprocessImportJobFromFirestore } from "./imports/reprocessImportJobFromFirestore";
export { processPatientDocumentFromStorage } from "./patientDocuments/processPatientDocumentFromStorage";
export { trackQrScan } from "./qr/trackQrScan";
export { searchRolodexContacts } from "./rolodex/searchRolodexContacts";

// Maintenance / rebuild tools
export { cleanDatabase } from "./maintenance/cleanDatabase";
export { rebuildEverything } from "./maintenance/rebuildEverything";
export { rebuildReportsAnalytics } from "./maintenance/rebuildReportsAnalytics";
export { reprocessImportJob } from "./maintenance/reprocessImportJob";
export { softResetReports } from "./maintenance/softResetReports";

// Product management
export { purgeProducts } from "./products/purgeProducts.js";

// Admin / reset tools
export { bootstrapAdminClaim } from "./bootstrapAdmin";
export { resetOperationalDatabase } from "./resetOperationalDatabase";
export {
  updateUserRole,
  disableDashboardUser,
  enableDashboardUser,
  deleteUserAccount,
  resetUserPassword,
} from "./adminUserManagement";

// Inventory barcode scanning
export { lookupInventoryByBarcode } from "./inventory/lookupInventoryByBarcode";
export { receiveInventoryByBarcode } from "./inventory/receiveInventoryByBarcode";
export { receiveScannedInventoryIntakeCallable } from "./inventory/receiveScannedInventoryIntake";
export { manualInventoryUpsertCallable } from "./inventory/manualInventoryUpsert";
export { manualInventoryMetadataUpdateCallable } from "./inventory/manualInventoryMetadataUpdate";
export { inventoryCleanupWorkflowCallable } from "./inventory/cleanupWorkflow";
export {
  issueInventoryByBarcode,
  cycleCountInventoryByBarcode,
  transferInventoryByBarcode,
} from "./inventory/inventoryTransactionFunctions";
export {
  createInventoryMovementCallable,
  reverseInventoryMovementCallable,
  reconcileInventoryCallable,
} from "./inventory/movementFunctions";
export {
  recordDeliveryScanWorkflowCallable,
  completeDeliveryTicketWorkflowCallable,
  finalizeDeliverySignatureWorkflowCallable,
  finalizeDeliveryDamagePhotosWorkflowCallable,
  deliveryTechCheckInWorkflowCallable,
  updateDeliveryRouteWorkflowCallable,
  checkoutRentalWorkflowCallable,
  createAndCheckoutRentalWorkflowCallable,
  returnRentalWorkflowCallable,
  exchangeRentalWorkflowCallable,
  cancelRentalWorkflowCallable,
  reportStaleRentalDraftsCallable,
  patientEquipmentWorkflowCallable,
  equipmentCheckInByBarcodeCallable,
  patientLifecycleWorkflowCallable,
  cleanupPendingWorkflowUploadsCallable,
} from "./domainWorkflows/domainWorkflowFunctions";
export { orderWorkflowCallable } from "./orders/orderWorkflowFunctions.js";
