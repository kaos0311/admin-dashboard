import type {
  PatientIndex,
  PatientTaskPriority,
  PatientTaskStatus,
  PatientWithDerived,
} from "../../lib/patientTypes";

export interface PatientDetailProps {
  selected: PatientWithDerived;

  savingId: string;
  savingNotes: boolean;
  savingTask: boolean;

  notesDraft: string;
  careNotesDraft: string;
  equipmentNotesDraft: string;
  billingNotesDraft: string;

  newTaskTitle: string;
  newTaskAssignedTo: string;
  newTaskDueDate: string;
  newTaskPriority: PatientTaskPriority;

  setNotesDraft: (value: string) => void;
  setCareNotesDraft: (value: string) => void;
  setEquipmentNotesDraft: (value: string) => void;
  setBillingNotesDraft: (value: string) => void;

  setNewTaskTitle: (value: string) => void;
  setNewTaskAssignedTo: (value: string) => void;
  setNewTaskDueDate: (value: string) => void;
  setNewTaskPriority: (value: PatientTaskPriority) => void;

  saveNotes: (patient: PatientIndex) => Promise<void>;

  addTask: (patient: PatientIndex) => Promise<void>;

  updateTaskStatus: (
    patient: PatientIndex,
    taskId: string,
    status: PatientTaskStatus
  ) => Promise<void>;

  archivePatient: (patient: PatientIndex) => Promise<void>;

  restorePatient: (patient: PatientIndex) => Promise<void>;

  destroyPatient: (patient: PatientIndex) => Promise<void>;
}