export type WipStatus =
  | "Open"
  | "Pending"
  | "Completed"
  | "Cancelled"
  | "On Hold"
  | string;

export type WipPriority =
  | "Low"
  | "Normal"
  | "High"
  | "Urgent"
  | string;

export type WipRecord = {
  id: string;

  patientName: string;
  employee: string;
  status: WipStatus;

  branch: string;
  orderNumber: string;
  payer: string;
  item: string;
  hcpcs: string;

  daysOld: number;
  searchText: string;

  priority?: WipPriority;
  createdAt?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown;
  dueDate?: unknown;
  notes?: string;

  [key: string]: unknown;
};


