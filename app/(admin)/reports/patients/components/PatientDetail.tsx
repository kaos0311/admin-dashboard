"use client";

import {
  Archive,
  ArchiveRestore,
  Banknote,
  Cake,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HeartPulse,
  NotebookPen,
  PackageCheck,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";

import type {
  PatientIndex,
  PatientTaskPriority,
  PatientTaskStatus,
  PatientWithDerived,
} from "../lib/patientTypes";
import {
  formatBirthday,
  formatDate,
  formatMoney,
  getAgeTurning,
  isBirthdayThisMonth,
  isDestroyEligible,
  numberField,
  textField,
} from "../lib/patientUtils";
import { EquipmentTable, PurchaseTable } from "../../../../components/PatientTables";
import {
  ActionButton,
  Badge,
  DataQualityPill,
  EmptyState,
  Info,
  Input,
  NoteBox,
  Panel,
  RiskPill,
  Section,
  StatusPill,
  TaskPriorityPill,
} from "./PatientUI";

export function PatientDetail({
  selected,
  savingId,
  savingNotes,
  savingTask,
  notesDraft,
  careNotesDraft,
  equipmentNotesDraft,
  billingNotesDraft,
  newTaskTitle,
  newTaskAssignedTo,
  newTaskDueDate,
  newTaskPriority,
  setNotesDraft,
  setCareNotesDraft,
  setEquipmentNotesDraft,
  setBillingNotesDraft,
  setNewTaskTitle,
  setNewTaskAssignedTo,
  setNewTaskDueDate,
  setNewTaskPriority,
  saveNotes,
  addTask,
  updateTaskStatus,
  archivePatient,
  restorePatient,
  destroyPatient,
}: {
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
}) {
  const flags = selected.riskFlags;
  const openTasks =
    selected.tasks?.filter((task) => task.status === "open") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">{selected.fullName}</h2>

            <StatusPill status={selected.status} />
            <RiskPill score={selected.riskScore} />
            <DataQualityPill score={selected.dataCompletenessScore} />

            {selected.cpap?.onRecord ? <Badge label="CPAP/PAP" /> : null}
            {selected.hospice ? <Badge label="Hospice" /> : null}
          </div>

          <p className="mt-1 text-sm text-zinc-400">
            DOB: {formatDate(selected.dateOfBirth)} | DOD:{" "}
            {formatDate(selected.dateOfDeath)}
          </p>

          {selected.snapshot || selected.patientSnapshot ? (
            <p className="mt-3 max-w-4xl rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
              {selected.snapshot || selected.patientSnapshot}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {selected.status === "active" ? (
            <ActionButton
              tone="amber"
              disabled={savingId === selected.id}
              onClick={() => void archivePatient(selected)}
              icon={<Archive className="h-4 w-4" aria-hidden="true" />}
              label="Archive"
            />
          ) : null}

          {selected.status === "archived" ? (
            <ActionButton
              tone="green"
              disabled={savingId === selected.id}
              onClick={() => void restorePatient(selected)}
              icon={<ArchiveRestore className="h-4 w-4" aria-hidden="true" />}
              label="Restore"
            />
          ) : null}

          {selected.status === "archived" ? (
            <ActionButton
              tone="red"
              disabled={savingId === selected.id || !isDestroyEligible(selected)}
              onClick={() => void destroyPatient(selected)}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              label="Destroy"
            />
          ) : null}
        </div>
      </div>

      {flags.length ? (
        <Panel
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          title="Risk / Completeness Flags"
          tone="red"
        >
          <div className="flex flex-wrap gap-2">
            {flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-100"
              >
                {flag}
              </span>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          title="Record Completeness"
          tone="neutral"
        >
          No major risk flags detected from indexed fields.
        </Panel>
      )}

      {isBirthdayThisMonth(selected.dateOfBirth) ? (
        <Panel
          icon={<Cake className="h-5 w-5" aria-hidden="true" />}
          title="Birthday Reminder"
          tone="amber"
        >
          {selected.fullName} turns {getAgeTurning(selected.dateOfBirth) ?? "—"}{" "}
          on {formatBirthday(selected.dateOfBirth)}.
        </Panel>
      ) : null}

      <Section
        title="Patient Identity"
        icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
      >
        <Info label="First Name" value={selected.firstName} />
        <Info label="Last Name" value={selected.lastName} />
        <Info label="Phone" value={selected.phone} />
        <Info label="Email" value={selected.email} />
        <Info label="Address" value={selected.address} />
        <Info label="City" value={selected.city} />
        <Info label="State" value={selected.state} />
        <Info label="ZIP" value={selected.zip} />
        <Info label="Sex" value={textField(selected.profile, "sex")} />
        <Info label="Height" value={textField(selected.profile, "height")} />
        <Info label="Weight" value={textField(selected.profile, "weight")} />
        <Info
          label="Patient ID"
          value={textField(selected.profile, "patientId")}
        />
        <Info
          label="Account #"
          value={textField(selected.profile, "accountNumber")}
        />
        <Info
          label="Patient Status"
          value={textField(selected.profile, "patientStatus")}
        />
        <Info
          label="Hub Status"
          value={textField(selected.profile, "patientHubStatus")}
        />
      </Section>

      <Section
        title="Insurance / Clinical"
        icon={<Stethoscope className="h-5 w-5" aria-hidden="true" />}
      >
        <Info
          label="Primary Insurance"
          value={
            textField(selected.insurance, "primaryInsurance") ||
            textField(selected.insurance, "payor")
          }
        />
        <Info
          label="Secondary Insurance"
          value={textField(selected.insurance, "secondaryInsurance")}
        />
        <Info
          label="Policy #"
          value={textField(selected.insurance, "policyNumber")}
        />
        <Info
          label="Insurance Status"
          value={textField(selected.insurance, "insuranceStatus")}
        />
        <Info
          label="Coverage Type"
          value={textField(selected.insurance, "coverageTypes")}
        />
        <Info
          label="Primary Doctor"
          value={textField(selected.profile, "primaryDoctor")}
        />
        <Info
          label="Ordering Doctor"
          value={textField(selected.profile, "orderingDoctor")}
        />
        <Info
          label="Registration Date"
          value={formatDate(textField(selected.profile, "registrationDate"))}
        />
        <Info
          label="Last Portal Login"
          value={formatDate(textField(selected.profile, "lastLoginDate"))}
        />
      </Section>

      <Section
        title="CPAP / PAP Therapy"
        icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
      >
        <Info label="On Record" value={selected.cpap?.onRecord ? "Yes" : "No"} />
        <Info label="Machine" value={selected.cpap?.machine} />
        <Info label="Mask Type" value={selected.cpap?.maskType} />
        <Info label="Humidifier" value={selected.cpap?.humidifier} />
        <Info label="Tubing" value={selected.cpap?.tubing} />
        <Info label="Filters" value={selected.cpap?.filters} />
        <Info label="Headgear" value={selected.cpap?.headgear} />
        <Info label="Pressure" value={selected.cpap?.pressure} />
        <Info label="Serial #" value={selected.cpap?.serialNumber} />
        <Info label="Setup Date" value={formatDate(selected.cpap?.setupDate)} />
        <Info
          label="Last Service"
          value={formatDate(selected.cpap?.lastServiceDate)}
        />
        <Info label="Compliance" value={selected.cpap?.complianceStatus} />
      </Section>

      <Section
        title="Current Equipment"
        icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="md:col-span-3">
          <EquipmentTable items={selected.currentEquipment ?? []} />
        </div>
      </Section>

      <Section
        title="Purchases Last 90 Days"
        icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="md:col-span-3">
          <PurchaseTable items={selected.purchasesLast90Days ?? []} />
        </div>
      </Section>

      <Section
        title="Delivery / PAR / CMN / WIP"
        icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
      >
        <Info
          label="Sales Order"
          value={textField(selected.deliverySummary, "salesOrderId")}
        />
        <Info
          label="Delivery Date"
          value={formatDate(
            textField(selected.deliverySummary, "actualDeliveryDate")
          )}
        />
        <Info
          label="Delivery Tech"
          value={textField(selected.deliverySummary, "deliveryTechName")}
        />
        <Info
          label="Delivery Notes"
          value={textField(selected.deliverySummary, "comments")}
        />
        <Info label="PAR #" value={textField(selected.authorization, "parNumber")} />
        <Info
          label="PAR Status"
          value={textField(selected.authorization, "parStatus")}
        />
        <Info
          label="PAR Expiration"
          value={formatDate(textField(selected.authorization, "parExpiration"))}
        />
        <Info label="CMN Status" value={textField(selected.cmn, "status")} />
        <Info label="CMN Form" value={textField(selected.cmn, "formName")} />
        <Info
          label="CMN Expiration"
          value={formatDate(textField(selected.cmn, "expiryDate"))}
        />
        <Info label="WIP Status" value={textField(selected.wip, "status")} />
        <Info
          label="WIP Assigned To"
          value={textField(selected.wip, "assignedTo")}
        />
        <Info
          label="WIP Days in State"
          value={String(numberField(selected.wip, "daysInState") || "")}
        />
      </Section>

      <Section
        title="Billing Snapshot"
        icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
      >
        <Info
          label="Last Invoice Date"
          value={formatDate(textField(selected.billing, "lastInvoiceDate"))}
        />
        <Info
          label="Last Payment Date"
          value={formatDate(textField(selected.billing, "lastPaymentDate"))}
        />
        <Info
          label="Charges 90 Days"
          value={formatMoney(numberField(selected.billing, "totalCharges90Days"))}
        />
        <Info
          label="Allowed 90 Days"
          value={formatMoney(numberField(selected.billing, "totalAllowed90Days"))}
        />
        <Info
          label="Payments 90 Days"
          value={formatMoney(numberField(selected.billing, "totalPayments90Days"))}
        />
        <Info
          label="Open Balance Estimate"
          value={formatMoney(
            numberField(selected.billing, "openBalanceEstimate")
          )}
        />
      </Section>

      <Section
        title="Care Coordination Tasks"
        icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="space-y-4 md:col-span-3">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-4">
            <Input
              label="Task Title"
              value={newTaskTitle}
              onChange={setNewTaskTitle}
              placeholder="Example: Follow up on PAR renewal"
            />

            <Input
              label="Assigned To"
              value={newTaskAssignedTo}
              onChange={setNewTaskAssignedTo}
              placeholder="Staff member"
            />

            <Input
              label="Due Date"
              type="date"
              value={newTaskDueDate}
              onChange={setNewTaskDueDate}
            />

            <label>
              <span className="mb-2 block text-xs text-zinc-400">Priority</span>
              <select
                title="Task priority"
                aria-label="Task priority"
                value={newTaskPriority}
                onChange={(event) =>
                  setNewTaskPriority(event.target.value as PatientTaskPriority)
                }
                className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none"
              >
                <option value="routine">Routine</option>
                <option value="watch">Watch</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void addTask(selected)}
              disabled={savingTask}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-4"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {savingTask ? "Saving Task..." : "Add Task"}
            </button>
          </div>

          {openTasks.length ? (
            <div className="space-y-2">
              {openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{task.title}</p>
                      <TaskPriorityPill priority={task.priority} />
                    </div>

                    <p className="mt-1 text-xs text-zinc-400">
                      Assigned: {task.assignedTo || "—"} | Due:{" "}
                      {formatDate(task.dueDate)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void updateTaskStatus(selected, task.id, "done")
                    }
                    disabled={savingTask}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Mark Done
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
              title="No open tasks"
              message="No open care coordination tasks are indexed for this patient."
            />
          )}
        </div>
      </Section>

      <Section
        title="Internal Notes"
        icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="grid gap-4 md:col-span-3 md:grid-cols-2">
          <NoteBox
            id="general-notes"
            label="General Snapshot / Owner Notes"
            value={notesDraft}
            onChange={setNotesDraft}
          />

          <NoteBox
            id="care-notes"
            label="Care Notes"
            value={careNotesDraft}
            onChange={setCareNotesDraft}
          />

          <NoteBox
            id="equipment-notes"
            label="Equipment Notes"
            value={equipmentNotesDraft}
            onChange={setEquipmentNotesDraft}
          />

          <NoteBox
            id="billing-notes"
            label="Billing Notes"
            value={billingNotesDraft}
            onChange={setBillingNotesDraft}
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="button"
            onClick={() => void saveNotes(selected)}
            disabled={savingNotes}
            className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingNotes ? "Saving Notes..." : "Save Notes"}
          </button>
        </div>
      </Section>

      <Section title="Retention" icon={<Clock className="h-5 w-5" aria-hidden="true" />}>
        <Info
          label="Last Activity"
          value={formatDate(selected.lastActivityDateComputed)}
        />
        <Info
          label="Destroy Eligible After"
          value={formatDate(selected.destroyEligibleDateComputed)}
        />
        <Info
          label="Destroy Eligibility"
          value={isDestroyEligible(selected) ? "Eligible now" : "Not eligible"}
        />

        <div className="md:col-span-3">
          {isDestroyEligible(selected) ? (
            <Panel
              icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
              title="Destruction Eligible"
              tone="red"
            >
              This archived patient appears eligible based on the last activity
              date. Verify equipment, billing, service, treatment, and legal
              retention requirements before marking destroyed.
            </Panel>
          ) : (
            <Panel
              icon={<Clock className="h-5 w-5" aria-hidden="true" />}
              title="Retention Status"
              tone="neutral"
            >
              Records can move from archived to destroyed only after 7 years
              with no equipment, billing, service, or treatment activity.
            </Panel>
          )}
        </div>
      </Section>
    </div>
  );
}