import type { PatientWithDerived } from "../../patients/lib/patientTypes";
import type { CpapEligibilityRow } from "../../patients/lib/cpapEligibility";

export type PickupRow = {
  patient: PatientWithDerived;
  eligibility: CpapEligibilityRow;
  clinicalOnly?: boolean;
};

export type PickupPatientTile = {
  patient: PatientWithDerived;
  rows: CpapEligibilityRow[];
  machineType: string;
  maskType: string;
  readyCount: number;
  soonCount: number;
  verifyCount: number;
  overdueCount: number;
};

export type SetupRow = {
  patient: PatientWithDerived;
  date: string;
  label: string;
};

export type StatTileId = "cpap" | "ready" | "soon" | "verify" | "overdue";

export type StatPatientGroups = Record<StatTileId, PatientWithDerived[]>;

export type ManualSetupAppointment = {
  id: string;
  patientName: string;
  patientKey?: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
};

export type CpapSupplyPull = {
  id: string;
  patientKey: string;
  patientName: string;
  supplyId: string;
  supplyLabel: string;
  dueDate: string;
  status: "pulled" | "picked_up" | "cancelled";
  pulledAt?: string;
  pickedUpAt?: string;
  updatedAt?: unknown;
};

export type CpapSupplyCallNote = {
  id: string;
  patientKey: string;
  patientName: string;
  phone: string;
  notes: string;
  suppliesSummary: string;
  updatedAt?: unknown;
};

export type CalendarEvent = {
  id: string;
  date: string;
  kind: "appointment" | "setup" | "supply" | "clinical";
  title: string;
  detail: string;
  status?: string;
  patient?: PatientWithDerived | null;
  appointment?: ManualSetupAppointment;
  pickupRow?: PickupRow;
};

export type StatTile = {
  id: StatTileId;
  label: string;
  value: number;
  patients: PatientWithDerived[];
};
