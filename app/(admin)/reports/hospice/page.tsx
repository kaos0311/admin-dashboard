"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Mail,
  PackageCheck,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";

const HOSPICE_COLLECTION = "hospicePatients";
const HOSPICE_QUERY_LIMIT = 250;

type HospiceTab = "active" | "deceased";
type CarePriority = "routine" | "watch" | "urgent";
type DeliveryStatus =
  | "none"
  | "pending"
  | "scheduled"
  | "delivered"
  | "pickup-required"
  | "completed";

type HospiceTaskStatus = "open" | "done";
type HospiceTaskPriority = "routine" | "watch" | "urgent";

type NurseProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  active?: boolean;
};

type HospiceTask = {
  id: string;
  title: string;
  dueDate: string;
  assignedTo: string;
  status: HospiceTaskStatus;
  priority: HospiceTaskPriority;
};

type HospiceEquipment = {
  id: string;
  name: string;
  serial: string;
  lotNumber: string;
  status: string;
  nextServiceDate: string;
};

type HospicePatientRow = {
  id: string;
  fullName: string;
  normalizedFullName: string;
  dob: string;
  dod: string;
  recordCount: number;
  patientStatuses: string[];
  payors: string[];
  reportType: string;

  hospiceNurseName: string;
  hospiceNursePhone: string;
  hospiceNurseEmail: string;

  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinEmail: string;

  poaName: string;
  poaPhone: string;
  poaEmail: string;

  carePriority: CarePriority;
  comfortNotes: string;
  equipmentNeeds: string;
  obituary: string;
  lastCareReview: string;

  deliveryStatus: DeliveryStatus;
  lastDeliveryDate: string;
  nextScheduledDelivery: string;
  assignedDriver: string;
  pickupNeeded: boolean;

  tasks: HospiceTask[];
  equipment: HospiceEquipment[];
};

type DraftState = Omit<
  HospicePatientRow,
  | "id"
  | "fullName"
  | "normalizedFullName"
  | "dob"
  | "dod"
  | "recordCount"
  | "patientStatuses"
  | "payors"
  | "reportType"
> & {
  selectedNurseProfileId: string;
};

type DraftMap = Record<string, DraftState>;

type DraftAction =
  | { type: "hydrate"; patients: HospicePatientRow[] }
  | {
      type: "update";
      patientId: string;
      key: keyof DraftState;
      value: DraftState[keyof DraftState];
    }
  | { type: "replace"; patientId: string; draft: DraftState };

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function hasDateOfDeath(value: string): boolean {
  return Boolean(value.trim());
}

function isCarePriority(value: unknown): value is CarePriority {
  return value === "routine" || value === "watch" || value === "urgent";
}

function isTaskStatus(value: unknown): value is HospiceTaskStatus {
  return value === "open" || value === "done";
}

function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return (
    value === "none" ||
    value === "pending" ||
    value === "scheduled" ||
    value === "delivered" ||
    value === "pickup-required" ||
    value === "completed"
  );
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTasks(value: unknown): HospiceTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): HospiceTask | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;

      return {
        id: getString(raw.id) || makeId("task"),
        title: getString(raw.title),
        dueDate: getString(raw.dueDate),
        assignedTo: getString(raw.assignedTo),
        status: isTaskStatus(raw.status) ? raw.status : "open",
        priority: isCarePriority(raw.priority) ? raw.priority : "routine",
      };
    })
    .filter((task): task is HospiceTask => Boolean(task?.title));
}

function normalizeEquipment(value: unknown): HospiceEquipment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): HospiceEquipment | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;

      return {
        id: getString(raw.id) || makeId("equipment"),
        name: getString(raw.name),
        serial: getString(raw.serial),
        lotNumber: getString(raw.lotNumber),
        status: getString(raw.status) || "assigned",
        nextServiceDate: getString(raw.nextServiceDate),
      };
    })
    .filter((equipment): equipment is HospiceEquipment => Boolean(equipment?.name));
}

function normalizeHospicePatient(
  id: string,
  data: Record<string, unknown>
): HospicePatientRow {
  const dateOfDeath =
    getString(data.dateOfDeath) ||
    getString(data.dod) ||
    getString(data.date_of_death) ||
    getString(data.DateOfDeath) ||
    getString(data.DOD);

  return {
    id,
    fullName:
      getString(data.fullName) ||
      getString(data.patientName) ||
      getString(data.PatientName),
    normalizedFullName: getString(data.normalizedFullName),
    dob: getString(data.dob) || getString(data.DOB),
    dod: dateOfDeath,
    recordCount: getNumber(data.recordCount),
    patientStatuses: Array.isArray(data.patientStatuses)
      ? data.patientStatuses.filter((value): value is string => typeof value === "string")
      : [],
    payors: Array.isArray(data.payors)
      ? data.payors.filter((value): value is string => typeof value === "string")
      : [],
    reportType: getString(data.reportType),

    hospiceNurseName: getString(data.hospiceNurseName),
    hospiceNursePhone: getString(data.hospiceNursePhone),
    hospiceNurseEmail: getString(data.hospiceNurseEmail),

    nextOfKinName: getString(data.nextOfKinName),
    nextOfKinRelationship: getString(data.nextOfKinRelationship),
    nextOfKinPhone: getString(data.nextOfKinPhone),
    nextOfKinEmail: getString(data.nextOfKinEmail),

    poaName: getString(data.poaName),
    poaPhone: getString(data.poaPhone),
    poaEmail: getString(data.poaEmail),

    carePriority: isCarePriority(data.carePriority) ? data.carePriority : "routine",
    comfortNotes: getString(data.comfortNotes),
    equipmentNeeds: getString(data.equipmentNeeds),
    obituary: getString(data.obituary),
    lastCareReview: getString(data.lastCareReview),

    deliveryStatus: isDeliveryStatus(data.deliveryStatus)
      ? data.deliveryStatus
      : "none",
    lastDeliveryDate: getString(data.lastDeliveryDate),
    nextScheduledDelivery: getString(data.nextScheduledDelivery),
    assignedDriver: getString(data.assignedDriver),
    pickupNeeded: getBoolean(data.pickupNeeded),

    tasks: normalizeTasks(data.tasks),
    equipment: normalizeEquipment(data.equipment),
  };
}

function buildDraft(patient: HospicePatientRow): DraftState {
  return {
    selectedNurseProfileId: "",

    hospiceNurseName: patient.hospiceNurseName,
    hospiceNursePhone: patient.hospiceNursePhone,
    hospiceNurseEmail: patient.hospiceNurseEmail,

    nextOfKinName: patient.nextOfKinName,
    nextOfKinRelationship: patient.nextOfKinRelationship,
    nextOfKinPhone: patient.nextOfKinPhone,
    nextOfKinEmail: patient.nextOfKinEmail,

    poaName: patient.poaName,
    poaPhone: patient.poaPhone,
    poaEmail: patient.poaEmail,

    carePriority: patient.carePriority,
    comfortNotes: patient.comfortNotes,
    equipmentNeeds: patient.equipmentNeeds,
    obituary: patient.obituary,
    lastCareReview: patient.lastCareReview,

    deliveryStatus: patient.deliveryStatus,
    lastDeliveryDate: patient.lastDeliveryDate,
    nextScheduledDelivery: patient.nextScheduledDelivery,
    assignedDriver: patient.assignedDriver,
    pickupNeeded: patient.pickupNeeded,

    tasks: patient.tasks,
    equipment: patient.equipment,
  };
}

function draftReducer(state: DraftMap, action: DraftAction): DraftMap {
  switch (action.type) {
    case "hydrate": {
      const next: DraftMap = {};

      for (const patient of action.patients) {
        next[patient.id] = state[patient.id] ?? buildDraft(patient);
      }

      return next;
    }

    case "update": {
      return {
        ...state,
        [action.patientId]: {
          ...state[action.patientId],
          [action.key]: action.value,
        },
      };
    }

    case "replace": {
      return {
        ...state,
        [action.patientId]: action.draft,
      };
    }

    default:
      return state;
  }
}

function calculateRisk(patient: HospicePatientRow, draft: DraftState): number {
  let score = 0;

  if (draft.carePriority === "urgent") score += 5;
  if (draft.carePriority === "watch") score += 3;
  if (!draft.hospiceNurseName.trim()) score += 3;
  if (!draft.hospiceNursePhone.trim()) score += 2;
  if (!draft.nextOfKinPhone.trim() && !draft.poaPhone.trim()) score += 2;
  if (draft.pickupNeeded) score += 2;
  if (draft.deliveryStatus === "pending" || draft.deliveryStatus === "pickup-required") {
    score += 2;
  }
  if (draft.tasks.some((task) => task.status === "open" && task.priority === "urgent")) {
    score += 3;
  }
  if (draft.equipment.some((item) => item.nextServiceDate)) score += 1;
  if (!patient.dod && draft.comfortNotes.trim().length < 10) score += 1;

  return score;
}

export default function HospicePage() {
  const [patients, setPatients] = useState<HospicePatientRow[]>([]);
  const [nurseProfiles, setNurseProfiles] = useState<NurseProfile[]>([]);
  const [drafts, dispatchDraft] = useReducer(draftReducer, {});

  const [savingId, setSavingId] = useState("");
  const [savingNurseProfileId, setSavingNurseProfileId] = useState("");
  const [loading, setLoading] = useState(true);
  const [nursesLoading, setNursesLoading] = useState(true);

  const [tab, setTab] = useState<HospiceTab>("active");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<CarePriority | "all">("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryStatus | "all">("all");
  const [nurseFilter, setNurseFilter] = useState("all");
  const [showOnlyOpenTasks, setShowOnlyOpenTasks] = useState(false);

  const [newNurseName, setNewNurseName] = useState("");
  const [newNursePhone, setNewNursePhone] = useState("");
  const [newNurseEmail, setNewNurseEmail] = useState("");

  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    const hospiceQuery = query(
      collection(db, HOSPICE_COLLECTION),
      orderBy("normalizedFullName"),
      limit(HOSPICE_QUERY_LIMIT)
    );

    const unsubscribe = onSnapshot(
      hospiceQuery,
      (snapshot) => {
        lastDocRef.current = snapshot.docs.at(-1) ?? null;

        const nextPatients = snapshot.docs.map((docSnap) =>
          normalizeHospicePatient(docSnap.id, docSnap.data() as Record<string, unknown>)
        );

        setPatients(nextPatients);
        dispatchDraft({ type: "hydrate", patients: nextPatients });
        setLoading(false);
      },
      (error) => {
        console.error("LOAD HOSPICE PATIENTS ERROR:", error);
        toast.error(
          "Could not load hospice patients. Check Firestore rules, collection name, and indexes."
        );
        setPatients([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const nurseQuery = query(
      collection(db, "hospiceNurseProfiles"),
      orderBy("name")
    );

    const unsubscribe = onSnapshot(
      nurseQuery,
      (snapshot) => {
        const nextProfiles = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;

          return {
            id: docSnap.id,
            name: getString(data.name),
            phone: getString(data.phone),
            email: getString(data.email),
            active: data.active !== false,
          };
        });

        setNurseProfiles(nextProfiles.filter((profile) => profile.active !== false));
        setNursesLoading(false);
      },
      (error) => {
        console.error("LOAD HOSPICE NURSES ERROR:", error);
        toast.error("Could not load hospice nurse profiles.");
        setNurseProfiles([]);
        setNursesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const enrichedPatients = useMemo(() => {
    return patients.map((patient) => {
      const draft = drafts[patient.id] ?? buildDraft(patient);
      const riskScore = calculateRisk(patient, draft);

      return {
        ...patient,
        uniqueStatuses: dedupeStrings(patient.patientStatuses).slice(0, 4),
        uniquePayors: dedupeStrings(patient.payors).slice(0, 4),
        riskScore,
      };
    });
  }, [patients, drafts]);

  const { activePatients, deceasedPatients } = useMemo(() => {
    return {
      activePatients: enrichedPatients.filter((patient) => !hasDateOfDeath(patient.dod)),
      deceasedPatients: enrichedPatients.filter((patient) => hasDateOfDeath(patient.dod)),
    };
  }, [enrichedPatients]);

  const visiblePatients = useMemo(() => {
    const base = tab === "active" ? activePatients : deceasedPatients;
    const term = search.trim().toLowerCase();

    return base
      .filter((patient) => {
        const draft = drafts[patient.id] ?? buildDraft(patient);

        if (priorityFilter !== "all" && draft.carePriority !== priorityFilter) {
          return false;
        }

        if (deliveryFilter !== "all" && draft.deliveryStatus !== deliveryFilter) {
          return false;
        }

        if (nurseFilter !== "all" && draft.hospiceNurseName !== nurseFilter) {
          return false;
        }

        if (
          showOnlyOpenTasks &&
          !draft.tasks.some((task) => task.status === "open")
        ) {
          return false;
        }

        if (!term) return true;

        const haystack = [
          patient.fullName,
          patient.dob,
          patient.dod,
          patient.patientStatuses.join(" "),
          patient.payors.join(" "),
          draft.hospiceNurseName,
          draft.hospiceNursePhone,
          draft.hospiceNurseEmail,
          draft.nextOfKinName,
          draft.nextOfKinRelationship,
          draft.nextOfKinPhone,
          draft.nextOfKinEmail,
          draft.poaName,
          draft.poaPhone,
          draft.poaEmail,
          draft.comfortNotes,
          draft.equipmentNeeds,
          draft.obituary,
          draft.assignedDriver,
          draft.deliveryStatus,
          draft.tasks.map((task) => task.title).join(" "),
          draft.equipment.map((item) => `${item.name} ${item.serial} ${item.lotNumber}`).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [
    tab,
    activePatients,
    deceasedPatients,
    search,
    priorityFilter,
    deliveryFilter,
    nurseFilter,
    showOnlyOpenTasks,
    drafts,
  ]);

  const urgentCount = activePatients.filter((patient) => {
    const draft = drafts[patient.id] ?? buildDraft(patient);
    return draft.carePriority === "urgent";
  }).length;

  const watchCount = activePatients.filter((patient) => {
    const draft = drafts[patient.id] ?? buildDraft(patient);
    return draft.carePriority === "watch";
  }).length;

  const missingNurseCount = activePatients.filter((patient) => {
    const draft = drafts[patient.id] ?? buildDraft(patient);
    return !draft.hospiceNurseName.trim();
  }).length;

  const openTaskCount = activePatients.reduce((total, patient) => {
    const draft = drafts[patient.id] ?? buildDraft(patient);
    return total + draft.tasks.filter((task) => task.status === "open").length;
  }, 0);

  const pickupNeededCount = activePatients.filter((patient) => {
    const draft = drafts[patient.id] ?? buildDraft(patient);
    return draft.pickupNeeded || draft.deliveryStatus === "pickup-required";
  }).length;

  const recentDeaths = useMemo(() => {
    return deceasedPatients.slice(0, 5);
  }, [deceasedPatients]);

  const nurseNames = useMemo(() => {
    return Array.from(
      new Set(
        patients
          .map((patient) => drafts[patient.id]?.hospiceNurseName || patient.hospiceNurseName)
          .filter(Boolean)
      )
    ).sort();
  }, [patients, drafts]);

  const updateDraft = useCallback(
    <K extends keyof DraftState>(patientId: string, key: K, value: DraftState[K]) => {
      dispatchDraft({ type: "update", patientId, key, value });
    },
    []
  );

  const applyNurseProfile = useCallback(
    (patientId: string, nurseId: string) => {
      const currentPatient = patients.find((patient) => patient.id === patientId);
      if (!currentPatient) return;

      const currentDraft = drafts[patientId] ?? buildDraft(currentPatient);
      const profile = nurseProfiles.find((nurse) => nurse.id === nurseId);

      dispatchDraft({
        type: "replace",
        patientId,
        draft: {
          ...currentDraft,
          selectedNurseProfileId: nurseId,
          hospiceNurseName: profile?.name ?? currentDraft.hospiceNurseName,
          hospiceNursePhone: profile?.phone ?? currentDraft.hospiceNursePhone,
          hospiceNurseEmail: profile?.email ?? currentDraft.hospiceNurseEmail,
        },
      });
    },
    [drafts, nurseProfiles, patients]
  );

  async function addNurseProfile() {
    const name = newNurseName.trim();

    if (!name) {
      toast.error("Enter the hospice nurse name first.");
      return;
    }

    try {
      setSavingNurseProfileId("new");

      await addDoc(collection(db, "hospiceNurseProfiles"), {
        name,
        phone: newNursePhone.trim(),
        email: newNurseEmail.trim(),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewNurseName("");
      setNewNursePhone("");
      setNewNurseEmail("");

      toast.success("Hospice nurse profile saved.");
    } catch (error) {
      console.error("SAVE NURSE PROFILE ERROR:", error);
      toast.error("Could not save hospice nurse profile.");
    } finally {
      setSavingNurseProfileId("");
    }
  }

  async function saveCurrentNurseAsProfile(patientId: string) {
    const draft = drafts[patientId];

    if (!draft?.hospiceNurseName.trim()) {
      toast.error("Enter a nurse name before saving as a profile.");
      return;
    }

    try {
      setSavingNurseProfileId(patientId);

      await addDoc(collection(db, "hospiceNurseProfiles"), {
        name: draft.hospiceNurseName.trim(),
        phone: draft.hospiceNursePhone.trim(),
        email: draft.hospiceNurseEmail.trim(),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Nurse saved as reusable profile.");
    } catch (error) {
      console.error("SAVE CURRENT NURSE PROFILE ERROR:", error);
      toast.error("Could not save nurse profile.");
    } finally {
      setSavingNurseProfileId("");
    }
  }

  async function savePatientCareDetails(patientId: string) {
    const draft = drafts[patientId];
    if (!draft) return;

    setSavingId(patientId);

    try {
      const reviewedAt = new Date().toLocaleString();

      await updateDoc(doc(db, HOSPICE_COLLECTION, patientId), {
        hospiceNurseName: draft.hospiceNurseName.trim(),
        hospiceNursePhone: draft.hospiceNursePhone.trim(),
        hospiceNurseEmail: draft.hospiceNurseEmail.trim(),

        nextOfKinName: draft.nextOfKinName.trim(),
        nextOfKinRelationship: draft.nextOfKinRelationship.trim(),
        nextOfKinPhone: draft.nextOfKinPhone.trim(),
        nextOfKinEmail: draft.nextOfKinEmail.trim(),

        poaName: draft.poaName.trim(),
        poaPhone: draft.poaPhone.trim(),
        poaEmail: draft.poaEmail.trim(),

        carePriority: draft.carePriority,
        comfortNotes: draft.comfortNotes.trim(),
        equipmentNeeds: draft.equipmentNeeds.trim(),
        obituary: draft.obituary.trim(),

        deliveryStatus: draft.deliveryStatus,
        lastDeliveryDate: draft.lastDeliveryDate.trim(),
        nextScheduledDelivery: draft.nextScheduledDelivery.trim(),
        assignedDriver: draft.assignedDriver.trim(),
        pickupNeeded: draft.pickupNeeded,

        tasks: draft.tasks.map((task) => ({
          ...task,
          title: task.title.trim(),
          assignedTo: task.assignedTo.trim(),
          dueDate: task.dueDate.trim(),
        })),

        equipment: draft.equipment.map((item) => ({
          ...item,
          name: item.name.trim(),
          serial: item.serial.trim(),
          lotNumber: item.lotNumber.trim(),
          status: item.status.trim(),
          nextServiceDate: item.nextServiceDate.trim(),
        })),

        lastCareReview: reviewedAt,
        updatedAt: serverTimestamp(),
      });

      toast.success("Hospice care details saved.");
    } catch (error) {
      console.error("SAVE HOSPICE DETAILS ERROR:", error);
      toast.error("Could not save hospice care details.");
    } finally {
      setSavingId("");
    }
  }

  function addTask(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    const draft = drafts[patientId] ?? buildDraft(patient);

    updateDraft(patientId, "tasks", [
      ...draft.tasks,
      {
        id: makeId("task"),
        title: "",
        dueDate: "",
        assignedTo: "",
        status: "open",
        priority: "routine",
      },
    ]);
  }

  function updateTask(
    patientId: string,
    taskId: string,
    patch: Partial<HospiceTask>
  ) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    const draft = drafts[patientId] ?? buildDraft(patient);

    updateDraft(
      patientId,
      "tasks",
      draft.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task
      )
    );
  }

  function removeTask(patientId: string, taskId: string) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    const draft = drafts[patientId] ?? buildDraft(patient);

    updateDraft(
      patientId,
      "tasks",
      draft.tasks.filter((task) => task.id !== taskId)
    );
  }

  function addEquipment(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    const draft = drafts[patientId] ?? buildDraft(patient);

    updateDraft(patientId, "equipment", [
      ...draft.equipment,
      {
        id: makeId("equipment"),
        name: "",
        serial: "",
        lotNumber: "",
        status: "assigned",
        nextServiceDate: "",
      },
    ]);
  }

  function updateEquipment(
    patientId: string,
    equipmentId: string,
    patch: Partial<HospiceEquipment>
  ) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    const draft = drafts[patientId] ?? buildDraft(patient);

    updateDraft(
      patientId,
      "equipment",
      draft.equipment.map((item) =>
        item.id === equipmentId ? { ...item, ...patch } : item
      )
    );
  }

  function removeEquipment(patientId: string, equipmentId: string) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    const draft = drafts[patientId] ?? buildDraft(patient);

    updateDraft(
      patientId,
      "equipment",
      draft.equipment.filter((item) => item.id !== equipmentId)
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-950 to-red-950/20 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-red-300">
                <HeartPulse className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-neutral-300">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Hospice operations command center
                </div>

                <h1 className="text-2xl font-bold md:text-3xl">
                  Hospice Care
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-neutral-400">
                  Living/deceased hospice tracking, nurse assignments, family contacts,
                  POA, delivery status, equipment, open care tasks, obituary notes,
                  pickup needs, and operational risk sorting.
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Live Firestore view from{" "}
                  <span className="font-mono text-neutral-300">
                    {HOSPICE_COLLECTION}
                  </span>
                  . Showing up to {HOSPICE_QUERY_LIMIT} records.
                </p>
              </div>
            </div>

            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Back to Reports
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Living Hospice" value={activePatients.length} />
          <StatCard label="Deceased" value={deceasedPatients.length} />
          <StatCard label="Urgent Care" value={urgentCount} tone="urgent" />
          <StatCard label="Watch Closely" value={watchCount} tone="watch" />
          <StatCard label="Missing Nurse" value={missingNurseCount} tone="missing" />
          <StatCard label="Open Tasks" value={openTaskCount} tone="task" />
        </section>

        {pickupNeededCount > 0 || recentDeaths.length > 0 ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <AlertPanel
              icon={<Truck className="h-5 w-5" aria-hidden="true" />}
              title="Pickup / Delivery Attention"
              description={`${pickupNeededCount} active hospice patient${
                pickupNeededCount === 1 ? "" : "s"
              } currently need pickup or delivery follow-up.`}
              tone="orange"
            />

            <AlertPanel
              icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
              title="Recent Deceased Hospice Records"
              description={
                recentDeaths.length
                  ? recentDeaths.map((patient) => patient.fullName || "Unnamed Patient").join(", ")
                  : "No deceased hospice records currently shown."
              }
              tone="red"
            />
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="mb-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-red-300" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">
                Reusable Hospice Nurse Profiles
              </h2>
              <p className="text-sm text-neutral-500">
                Save nurse profiles once, then select them from patient dropdowns.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              label="Nurse Name"
              value={newNurseName}
              onChange={setNewNurseName}
              placeholder="Example: Nurse Smith"
            />
            <Input
              label="Nurse Phone"
              value={newNursePhone}
              onChange={setNewNursePhone}
              placeholder="Phone"
            />
            <Input
              label="Nurse Email"
              value={newNurseEmail}
              onChange={setNewNurseEmail}
              placeholder="Email"
            />

            <button
              type="button"
              onClick={() => void addNurseProfile()}
              disabled={savingNurseProfileId === "new"}
              className="mt-6 inline-flex h-[46px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {savingNurseProfileId === "new" ? "Saving..." : "Add Nurse"}
            </button>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Saved nurse profiles: {nursesLoading ? "Loading..." : nurseProfiles.length}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <TabButton
                active={tab === "active"}
                onClick={() => setTab("active")}
                label={`Living Hospice (${activePatients.length})`}
                tone="green"
              />
              <TabButton
                active={tab === "deceased"}
                onClick={() => setTab("deceased")}
                label={`Deceased Hospice (${deceasedPatients.length})`}
                tone="red"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-3">
                <Search className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                <span className="sr-only">Search hospice patients</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, nurse, POA, notes..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-500"
                />
              </label>

              <Select
                label="Filter by care priority"
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value as CarePriority | "all")}
                options={[
                  ["all", "All Priority"],
                  ["routine", "Routine"],
                  ["watch", "Watch Closely"],
                  ["urgent", "Urgent"],
                ]}
              />

              <Select
                label="Filter by delivery status"
                value={deliveryFilter}
                onChange={(value) => setDeliveryFilter(value as DeliveryStatus | "all")}
                options={[
                  ["all", "All Delivery"],
                  ["none", "No Status"],
                  ["pending", "Pending"],
                  ["scheduled", "Scheduled"],
                  ["delivered", "Delivered"],
                  ["pickup-required", "Pickup Required"],
                  ["completed", "Completed"],
                ]}
              />

              <Select
                label="Filter by hospice nurse"
                value={nurseFilter}
                onChange={setNurseFilter}
                options={[
                  ["all", "All Nurses"],
                  ...nurseNames.map((name) => [name, name] as [string, string]),
                ]}
              />

              <button
                type="button"
                onClick={() => setShowOnlyOpenTasks((current) => !current)}
                className={`rounded-2xl border px-4 py-3 text-sm transition ${
                  showOnlyOpenTasks
                    ? "border-blue-400/30 bg-blue-500/10 text-blue-300"
                    : "border-white/10 bg-black/40 text-neutral-300 hover:bg-white/5"
                }`}
              >
                Open Tasks Only
              </button>
            </div>
          </div>

          {loading ? (
            <EmptyState message="Loading hospice patients..." />
          ) : visiblePatients.length === 0 ? (
            <EmptyState
              message={
                tab === "active"
                  ? "No living hospice patients found for these filters."
                  : "No deceased hospice patients found for these filters."
              }
            />
          ) : (
            <div className="space-y-5">
              {visiblePatients.map((patient) => {
                const draft = drafts[patient.id] ?? buildDraft(patient);
                const riskScore = calculateRisk(patient, draft);

                return (
                  <article
                    key={patient.id}
                    className="rounded-3xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">
                            {patient.fullName || "Unnamed Patient"}
                          </h2>

                          <PriorityBadge priority={draft.carePriority} />
                          <DeliveryBadge status={draft.deliveryStatus} />
                          <RiskBadge score={riskScore} />

                          {patient.dod ? (
                            <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-300">
                              Deceased
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                              Living hospice
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-sm text-neutral-400">
                          DOB: {patient.dob || "-"}
                          {patient.dod ? ` • DOD: ${patient.dod}` : ""}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Chip label={`${patient.recordCount.toLocaleString()} records`} />
                          {patient.uniqueStatuses.map((status, index) => (
                            <Chip key={`${patient.id}-status-${index}`} label={status} />
                          ))}
                          {patient.uniquePayors.map((payor, index) => (
                            <Chip key={`${patient.id}-payor-${index}`} label={payor} />
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/reports/patients/${encodeURIComponent(patient.id)}`}
                          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
                        >
                          Open Profile
                        </Link>

                        <button
                          type="button"
                          onClick={() => void savePatientCareDetails(patient.id)}
                          disabled={savingId === patient.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                          {savingId === patient.id ? "Saving..." : "Save Care"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-3">
                      <Panel title="Hospice Nurse Assigned">
                        <label htmlFor={`nurse-profile-${patient.id}`} className="block">
                          <div className="mb-2 text-xs text-neutral-400">
                            Use Saved Nurse Profile
                          </div>
                          <select
                            id={`nurse-profile-${patient.id}`}
                            title="Use saved nurse profile"
                            aria-label="Use saved nurse profile"
                            value={draft.selectedNurseProfileId}
                            onChange={(event) =>
                              applyNurseProfile(patient.id, event.target.value)
                            }
                            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
                          >
                            <option value="">Select saved nurse...</option>
                            {nurseProfiles.map((nurse) => (
                              <option key={nurse.id} value={nurse.id}>
                                {nurse.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <Input
                          label="Nurse Name"
                          value={draft.hospiceNurseName}
                          onChange={(value) =>
                            updateDraft(patient.id, "hospiceNurseName", value)
                          }
                        />
                        <Input
                          label="Nurse Phone"
                          value={draft.hospiceNursePhone}
                          onChange={(value) =>
                            updateDraft(patient.id, "hospiceNursePhone", value)
                          }
                        />
                        <Input
                          label="Nurse Email"
                          value={draft.hospiceNurseEmail}
                          onChange={(value) =>
                            updateDraft(patient.id, "hospiceNurseEmail", value)
                          }
                        />

                        <div className="flex flex-wrap gap-2">
                          <ContactActions
                            phone={draft.hospiceNursePhone}
                            email={draft.hospiceNurseEmail}
                          />

                          <button
                            type="button"
                            onClick={() => void saveCurrentNurseAsProfile(patient.id)}
                            disabled={savingNurseProfileId === patient.id}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Save Nurse Profile
                          </button>
                        </div>
                      </Panel>

                      <Panel title="Next of Kin">
                        <Input
                          label="Name"
                          value={draft.nextOfKinName}
                          onChange={(value) =>
                            updateDraft(patient.id, "nextOfKinName", value)
                          }
                        />
                        <Input
                          label="Relationship"
                          value={draft.nextOfKinRelationship}
                          onChange={(value) =>
                            updateDraft(patient.id, "nextOfKinRelationship", value)
                          }
                        />
                        <Input
                          label="Phone"
                          value={draft.nextOfKinPhone}
                          onChange={(value) =>
                            updateDraft(patient.id, "nextOfKinPhone", value)
                          }
                        />
                        <Input
                          label="Email"
                          value={draft.nextOfKinEmail}
                          onChange={(value) =>
                            updateDraft(patient.id, "nextOfKinEmail", value)
                          }
                        />

                        <ContactActions
                          phone={draft.nextOfKinPhone}
                          email={draft.nextOfKinEmail}
                        />
                      </Panel>

                      <Panel title="POA / Decision Maker">
                        <Input
                          label="POA Name"
                          value={draft.poaName}
                          onChange={(value) => updateDraft(patient.id, "poaName", value)}
                        />
                        <Input
                          label="POA Phone"
                          value={draft.poaPhone}
                          onChange={(value) => updateDraft(patient.id, "poaPhone", value)}
                        />
                        <Input
                          label="POA Email"
                          value={draft.poaEmail}
                          onChange={(value) => updateDraft(patient.id, "poaEmail", value)}
                        />

                        <ContactActions phone={draft.poaPhone} email={draft.poaEmail} />
                      </Panel>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <Panel title="Care Priority">
                        <Select
                          label="Priority Level"
                          value={draft.carePriority}
                          onChange={(value) =>
                            updateDraft(patient.id, "carePriority", value as CarePriority)
                          }
                          options={[
                            ["routine", "Routine"],
                            ["watch", "Watch Closely"],
                            ["urgent", "Urgent / Fragile"],
                          ]}
                        />

                        {draft.carePriority === "urgent" ? (
                          <div className="mt-3 flex gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            High attention patient. Review equipment, family contact,
                            and comfort needs before dispatch.
                          </div>
                        ) : null}
                      </Panel>

                      <Panel title="Comfort Notes">
                        <TextArea
                          label="Comfort notes"
                          value={draft.comfortNotes}
                          onChange={(value) =>
                            updateDraft(patient.id, "comfortNotes", value)
                          }
                          placeholder="Care preferences, comfort concerns, delivery sensitivity, access notes, family instructions..."
                        />
                      </Panel>

                      <Panel title="Equipment / Supply Needs">
                        <TextArea
                          label="Equipment needs"
                          value={draft.equipmentNeeds}
                          onChange={(value) =>
                            updateDraft(patient.id, "equipmentNeeds", value)
                          }
                          placeholder="Oxygen, bed, mattress, wheelchair, suction, commode, delivery notes..."
                        />
                      </Panel>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <Panel title="Delivery / Pickup">
                        <Select
                          label="Delivery Status"
                          value={draft.deliveryStatus}
                          onChange={(value) =>
                            updateDraft(patient.id, "deliveryStatus", value as DeliveryStatus)
                          }
                          options={[
                            ["none", "No Status"],
                            ["pending", "Pending"],
                            ["scheduled", "Scheduled"],
                            ["delivered", "Delivered"],
                            ["pickup-required", "Pickup Required"],
                            ["completed", "Completed"],
                          ]}
                        />

                        <Input
                          label="Assigned Driver"
                          value={draft.assignedDriver}
                          onChange={(value) =>
                            updateDraft(patient.id, "assignedDriver", value)
                          }
                        />

                        <Input
                          label="Last Delivery Date"
                          type="date"
                          value={draft.lastDeliveryDate}
                          onChange={(value) =>
                            updateDraft(patient.id, "lastDeliveryDate", value)
                          }
                        />

                        <Input
                          label="Next Scheduled Delivery"
                          type="date"
                          value={draft.nextScheduledDelivery}
                          onChange={(value) =>
                            updateDraft(patient.id, "nextScheduledDelivery", value)
                          }
                        />

                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-300">
                          <input
                            type="checkbox"
                            checked={draft.pickupNeeded}
                            onChange={(event) =>
                              updateDraft(patient.id, "pickupNeeded", event.target.checked)
                            }
                            className="h-4 w-4"
                          />
                          Pickup needed
                        </label>
                      </Panel>

                      <Panel title="Obituary / Remembrance Note">
                        <TextArea
                          label="Obituary or remembrance"
                          value={draft.obituary}
                          onChange={(value) => updateDraft(patient.id, "obituary", value)}
                          placeholder="Optional. Family-provided obituary note, remembrance, or service detail."
                          rows={8}
                        />
                      </Panel>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <Panel
                        title="Care Tasks"
                        action={
                          <button
                            type="button"
                            onClick={() => addTask(patient.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add Task
                          </button>
                        }
                      >
                        {draft.tasks.length === 0 ? (
                          <EmptyState message="No tasks saved for this patient." />
                        ) : (
                          <div className="space-y-3">
                            {draft.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="rounded-2xl border border-white/10 bg-black/30 p-3"
                              >
                                <div className="grid gap-2 md:grid-cols-2">
                                  <Input
                                    label="Task Title"
                                    value={task.title}
                                    onChange={(value) =>
                                      updateTask(patient.id, task.id, { title: value })
                                    }
                                  />
                                  <Input
                                    label="Assigned To"
                                    value={task.assignedTo}
                                    onChange={(value) =>
                                      updateTask(patient.id, task.id, { assignedTo: value })
                                    }
                                  />
                                  <Input
                                    label="Due Date"
                                    type="date"
                                    value={task.dueDate}
                                    onChange={(value) =>
                                      updateTask(patient.id, task.id, { dueDate: value })
                                    }
                                  />
                                  <Select
                                    label="Task Priority"
                                    value={task.priority}
                                    onChange={(value) =>
                                      updateTask(patient.id, task.id, {
                                        priority: value as HospiceTaskPriority,
                                      })
                                    }
                                    options={[
                                      ["routine", "Routine"],
                                      ["watch", "Watch"],
                                      ["urgent", "Urgent"],
                                    ]}
                                  />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateTask(patient.id, task.id, {
                                        status: task.status === "open" ? "done" : "open",
                                      })
                                    }
                                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    {task.status === "open" ? "Mark Done" : "Reopen"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => removeTask(patient.id, task.id)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20"
                                  >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Panel>

                      <Panel
                        title="Assigned Equipment"
                        action={
                          <button
                            type="button"
                            onClick={() => addEquipment(patient.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/20"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add Equipment
                          </button>
                        }
                      >
                        {draft.equipment.length === 0 ? (
                          <EmptyState message="No assigned equipment saved." />
                        ) : (
                          <div className="space-y-3">
                            {draft.equipment.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-white/10 bg-black/30 p-3"
                              >
                                <div className="grid gap-2 md:grid-cols-2">
                                  <Input
                                    label="Equipment Name"
                                    value={item.name}
                                    onChange={(value) =>
                                      updateEquipment(patient.id, item.id, { name: value })
                                    }
                                  />
                                  <Input
                                    label="Serial Number"
                                    value={item.serial}
                                    onChange={(value) =>
                                      updateEquipment(patient.id, item.id, { serial: value })
                                    }
                                  />
                                  <Input
                                    label="Lot Number"
                                    value={item.lotNumber}
                                    onChange={(value) =>
                                      updateEquipment(patient.id, item.id, { lotNumber: value })
                                    }
                                  />
                                  <Input
                                    label="Equipment Status"
                                    value={item.status}
                                    onChange={(value) =>
                                      updateEquipment(patient.id, item.id, { status: value })
                                    }
                                  />
                                  <Input
                                    label="Next Service Date"
                                    type="date"
                                    value={item.nextServiceDate}
                                    onChange={(value) =>
                                      updateEquipment(patient.id, item.id, {
                                        nextServiceDate: value,
                                      })
                                    }
                                  />
                                </div>

                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={() => removeEquipment(patient.id, item.id)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20"
                                  >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    Remove Equipment
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Panel>
                    </div>

                    <div className="mt-4 text-xs text-neutral-500">
                      Last care review: {draft.lastCareReview || patient.lastCareReview || "-"}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "urgent" | "watch" | "missing" | "task";
}) {
  const toneClass =
    tone === "urgent"
      ? "border-red-400/20 bg-red-500/10 text-red-300"
      : tone === "watch"
        ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-300"
        : tone === "missing"
          ? "border-orange-400/20 bg-orange-500/10 text-orange-300"
          : tone === "task"
            ? "border-blue-400/20 bg-blue-500/10 text-blue-300"
            : "border-white/10 bg-neutral-950 text-white";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function AlertPanel({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: "red" | "orange";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-400/20 bg-red-500/10 text-red-300"
      : "border-orange-400/20 bg-orange-500/10 text-orange-300";

  return (
    <section className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-neutral-300">{description}</p>
        </div>
      </div>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: CarePriority }) {
  if (priority === "urgent") {
    return (
      <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-300">
        Urgent
      </span>
    );
  }

  if (priority === "watch") {
    return (
      <span className="rounded-full border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">
        Watch
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-neutral-300">
      Routine
    </span>
  );
}

function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const labelMap: Record<DeliveryStatus, string> = {
    none: "No Delivery Status",
    pending: "Delivery Pending",
    scheduled: "Delivery Scheduled",
    delivered: "Delivered",
    "pickup-required": "Pickup Required",
    completed: "Completed",
  };

  return (
    <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
      {labelMap[status]}
    </span>
  );
}

function RiskBadge({ score }: { score: number }) {
  const tone =
    score >= 8
      ? "border-red-400/20 bg-red-500/10 text-red-300"
      : score >= 4
        ? "border-yellow-400/20 bg-yellow-500/10 text-yellow-300"
        : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>
      Risk {score}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: "green" | "red";
}) {
  const activeClass =
    tone === "green"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
      : "border-red-500/40 bg-red-500/15 text-red-300";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? activeClass
          : "border-white/10 bg-black/30 text-neutral-300 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-neutral-950/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ContactActions({ phone, email }: { phone: string; email: string }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/20"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Call
        </a>
      ) : null}

      {email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/20"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          Email
        </a>
      ) : null}

      {!phone && !email ? (
        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-500">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          No contact saved
        </div>
      ) : null}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date" | "email" | "tel";
}) {
  const id = `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 text-xs text-neutral-400">{label}</div>
      <input
        id={id}
        name={id}
        type={type}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const id = `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label htmlFor={id} className="block">
      <div className="mb-2 text-xs text-neutral-400">{label}</div>
      <select
        id={id}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = `textarea-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label htmlFor={id} className="block">
      <div className="sr-only">{label}</div>
      <textarea
        id={id}
        name={id}
        title={label}
        aria-label={label}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500"
      />
    </label>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-neutral-300">
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-400">
      {message}
    </div>
  );
}