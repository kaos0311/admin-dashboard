export interface BuildPatientSnapshotParams {
  fullName: string;
  dateOfBirth: string;
  city: string;
  state: string;
  hospice: boolean;
  cpapOnRecord: boolean;
  currentEquipmentCount: number;
  recentPurchaseCount: number;
  primaryInsurance: string;
  wipStatus: string;
  openBalanceEstimate: number;
}

export function buildPatientSnapshot(
  params: BuildPatientSnapshotParams
): string {
  const pieces: string[] = [];

  pieces.push(params.fullName || "Unnamed patient");

  if (params.dateOfBirth) {
    pieces.push(`DOB ${params.dateOfBirth}`);
  }

  if (params.city || params.state) {
    pieces.push(
      [params.city, params.state]
        .filter(Boolean)
        .join(", ")
    );
  }

  if (params.primaryInsurance) {
    pieces.push(params.primaryInsurance);
  }

  if (params.hospice) {
    pieces.push("hospice flagged");
  }

  if (params.cpapOnRecord) {
    pieces.push("CPAP/PAP info on record");
  }

  if (params.currentEquipmentCount > 0) {
    pieces.push(
      `${params.currentEquipmentCount} active equipment item(s)`
    );
  }

  if (params.recentPurchaseCount > 0) {
    pieces.push(
      `${params.recentPurchaseCount} purchase(s) in last 90 days`
    );
  }

  if (params.wipStatus) {
    pieces.push(`WIP: ${params.wipStatus}`);
  }

  if (params.openBalanceEstimate > 0) {
    pieces.push(
      `estimated open balance $${params.openBalanceEstimate.toFixed(2)}`
    );
  }

  return pieces.join(" • ");
}
