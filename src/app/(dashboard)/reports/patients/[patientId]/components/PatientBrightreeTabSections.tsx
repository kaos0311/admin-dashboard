import {
  Activity,
  Banknote,
  CalendarClock,
  ClipboardCheck,
  FileClock,
  FileText,
  History,
  Inbox,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { badges, glass, tables, typography } from "@/theme";

import PatientDocumentsPanel from "@/app/components/patients/PatientDocumentsPanel";

import type {
  PatientAuthorizationLine,
  PatientRecord,
  PatientTask,
  PatientTaskPriority,
  PatientTaskStatus,
} from "../patient-detail-types";
import {
  formatDate,
  formatMoney,
  numberField,
  safeRecord,
  textField,
} from "../patient-detail-utils";

import { EquipmentTable } from "./EquipmentTable";
import {
  EmptyState,
  Info,
  RecordCompletePanel,
  RiskFlagPanel,
  Section,
} from "./PatientDetailPrimitives";
import { PatientBirthdayPanel } from "./PatientBirthdayPanel";
import { PatientExportReadinessSection } from "./PatientExportReadinessSection";
import { PatientNotesSection } from "./PatientNotesSection";
import { PatientReportSources } from "./PatientReportSources";
import { PatientRetentionSection } from "./PatientRetentionSection";
import { PatientStatsGrid } from "./PatientStatsGrid";
import { PatientTasksSection } from "./PatientTasksSection";
import { PatientTimelineSection } from "./PatientTimelineSection";
import { PurchaseTable } from "./PurchaseTable";

type BirthdayInfo = {
  isThisMonth: boolean;
  birthday: string;
  ageTurning: number | null;
};

type TaskProps = {
  openTasks: PatientTask[];
  completedTasks: PatientTask[];
  savingTask: boolean;
  newTaskTitle: string;
  setNewTaskTitle: (value: string) => void;
  newTaskAssignedTo: string;
  setNewTaskAssignedTo: (value: string) => void;
  newTaskDueDate: string;
  setNewTaskDueDate: (value: string) => void;
  newTaskPriority: PatientTaskPriority;
  setNewTaskPriority: (value: PatientTaskPriority) => void;
  addTask: () => Promise<void>;
  updateTaskStatus: (
    taskId: string,
    status: PatientTaskStatus
  ) => Promise<void>;
};

type NotesProps = {
  notesDraft: string;
  setNotesDraft: (value: string) => void;
  careNotesDraft: string;
  setCareNotesDraft: (value: string) => void;
  equipmentNotesDraft: string;
  setEquipmentNotesDraft: (value: string) => void;
  billingNotesDraft: string;
  setBillingNotesDraft: (value: string) => void;
  savingNotes: boolean;
  saveNotes: () => Promise<void>;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }

  return "";
}

function sectionField(
  patient: PatientRecord,
  section: string,
  ...keys: string[]
): string {
  const brightree = safeRecord(patient.brightree);
  const source = safeRecord(brightree?.[section]);

  if (!source) return "";

  for (const key of keys) {
    const exact = cleanText(source[key]);
    if (exact) return exact;

    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const match = Object.entries(source).find(
      ([sourceKey]) =>
        sourceKey.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedKey
    );

    if (match) {
      const text = cleanText(match[1]);
      if (text) return text;
    }
  }

  return "";
}

function fullAddress(patient: PatientRecord): string {
  const line1 = firstText(
    patient.address,
    sectionField(patient, "contact", "Delivery Address Address 1", "Billing Address Address 1")
  );
  const city = firstText(
    patient.city,
    sectionField(patient, "contact", "Delivery Address City", "Billing Address City")
  );
  const state = firstText(
    patient.state,
    sectionField(patient, "contact", "Delivery Address State", "Billing Address State")
  );
  const zip = firstText(
    patient.zip,
    sectionField(patient, "contact", "Delivery Address Postal Code", "Billing Address Postal Code")
  );

  return [line1, [city, state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function doctorName(patient: PatientRecord, prefix: "Ordering" | "Primary" | "Referring"): string {
  return firstText(
    sectionField(
      patient,
      "physicians",
      `${prefix} Doctor`,
      `${prefix} Doctor Name`
    ),
    [
      sectionField(patient, "physicians", `${prefix} Doctor First Name`),
      sectionField(patient, "physicians", `${prefix} Doctor Last Name`),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function uniquePayors(patient: PatientRecord): string[] {
  const direct = [
    textField(patient.insurance, "primaryInsurance"),
    textField(patient.insurance, "secondaryInsurance"),
    textField(patient.insurance, "tertiaryInsurance"),
    textField(patient.insurance, "payor"),
  ];
  const linePayors = (patient.authorizationLines ?? []).map((line) => line.insurance);

  return Array.from(
    new Set([...direct, ...linePayors].map(cleanText).filter(Boolean))
  );
}

function policyValue(patient: PatientRecord, payor: string, key: keyof PatientAuthorizationLine): string {
  const line = (patient.authorizationLines ?? []).find(
    (item) => cleanText(item.insurance) === payor
  );

  return cleanText(line?.[key]);
}

function DiagnosisTable({
  title,
  rows,
}: {
  title: string;
  rows: string[];
}) {
  return (
    <Section title={title} icon={<Stethoscope className="h-5 w-5" />}>
      <div className="md:col-span-3">
        {rows.length ? (
          <div className={tables.wrapper}>
            <table className={tables.table}>
              <thead className={tables.head}>
                <tr>
                  <th className={tables.headCell}>Seq</th>
                  <th className={tables.headCell}>Diagnosis Code</th>
                </tr>
              </thead>
              <tbody className={tables.body}>
                {rows.map((row, index) => (
                  <tr key={`${row}-${index}`} className={tables.row}>
                    <td className={tables.cell}>{index + 1}</td>
                    <td className={tables.cellStrong}>{row}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={tables.empty}>No diagnosis codes indexed.</p>
        )}
      </div>
    </Section>
  );
}

export function OrderTab({
  patient,
  openTasks,
  riskScore,
  riskFlags,
  birthdayInfo,
}: {
  patient: PatientRecord;
  openTasks: PatientTask[];
  riskScore: number;
  riskFlags: string[];
  birthdayInfo: BirthdayInfo | null;
}) {
  return (
    <>
      {riskFlags.length ? <RiskFlagPanel flags={riskFlags} /> : <RecordCompletePanel />}

      {birthdayInfo ? (
        <PatientBirthdayPanel
          fullName={patient.fullName}
          isThisMonth={birthdayInfo.isThisMonth}
          birthday={birthdayInfo.birthday}
          ageTurning={birthdayInfo.ageTurning}
        />
      ) : null}

      <PatientStatsGrid patient={patient} openTasks={openTasks} riskScore={riskScore} />

      <Section title="Delivery" icon={<PackageCheck className="h-5 w-5" />}>
        <Info label="Scheduled Date Needed" value={formatDate(textField(patient.deliverySummary, "scheduledDateNeeded"))} />
        <Info label="Actual Date Needed" value={formatDate(textField(patient.deliverySummary, "actualDateNeeded"))} />
        <Info label="Use Patient Address" value={fullAddress(patient) ? "Yes" : "No"} />
        <Info label="Address" value={fullAddress(patient)} />
        <Info label="Deliverable" value={textField(patient.deliverySummary, "deliverable") || "Review"} />
        <Info label="Phone" value={firstText(patient.phone, sectionField(patient, "contact", "Delivery Address Phone", "Billing Address Phone"))} />
        <Info label="Facility" value={sectionField(patient, "facilities", "Facility", "Facility Name")} />
        <Info label="Tax Zone" value={textField(patient.billing, "taxZone")} />
        <Info label="Delivery Note" value={textField(patient.deliverySummary, "comments")} />
        <Info label="Signature Required" value={textField(patient.deliverySummary, "signatureRequired")} />
      </Section>

      <Section title="General" icon={<ShieldCheck className="h-5 w-5" />}>
        <Info label="Template Type" value={textField(patient.profile, "templateType")} />
        <Info label="Template Name" value={textField(patient.profile, "templateName")} />
        <Info label="Manual Hold" value={textField(patient.profile, "manualHold")} />
        <Info label="Hold Reason" value={textField(patient.profile, "holdReason")} />
        <Info label="Stop Reason" value={textField(patient.profile, "stopReason")} />
        <Info label="Branch" value={firstText(textField(patient.profile, "branchOffice"), sectionField(patient, "demographics", "Patient Branch Office"))} />
        <Info label="Inv. Location" value={textField(patient.profile, "inventoryLocation")} />
        <Info label="Classification" value={textField(patient.profile, "classification")} />
        <Info label="Place of Service" value={textField(patient.profile, "placeOfService")} />
        <Info label="Reference" value={textField(patient.profile, "reference")} />
      </Section>

      <Section title="Sales Order Default Work In Progress" icon={<ClipboardCheck className="h-5 w-5" />}>
        <Info label="WIP State" value={textField(patient.wip, "status")} />
        <Info label="Assigned To" value={textField(patient.wip, "assignedTo")} />
      </Section>
    </>
  );
}

export function ClinicalTab({ patient }: { patient: PatientRecord }) {
  const diagnosisRows = [
    textField(patient.cmn, "diagnosisCode"),
    textField(patient.authorization, "diagnosisCode"),
    sectionField(patient, "diagnosis", "ICD-10", "Diagnosis Code"),
  ].filter(Boolean);

  return (
    <>
      <Section title="General" icon={<UserRound className="h-5 w-5" />}>
        <Info label="Name" value={patient.fullName} />
        <Info label="Address" value={fullAddress(patient)} />
        <Info label="Phone" value={patient.phone} />
        <Info label="Mobile" value={sectionField(patient, "contact", "Billing Address Mobile Phone", "Delivery Address Mobile Phone")} />
        <Info label="Marketing Rep" value={textField(patient.profile, "marketingRep")} />
        <Info label="Practitioner" value={doctorName(patient, "Primary")} />
      </Section>

      <Section title="Ordering Doctor" icon={<Stethoscope className="h-5 w-5" />}>
        <Info label="Ordering Doctor" value={doctorName(patient, "Ordering")} />
      </Section>

      <Section title="Marketing Referral" icon={<Activity className="h-5 w-5" />}>
        <Info label="Type" value={sectionField(patient, "referrals", "Referral Type", "Type")} />
        <Info label="Referral" value={sectionField(patient, "referrals", "Referral Name")} />
      </Section>

      <Section title="Rendering Provider" icon={<Stethoscope className="h-5 w-5" />}>
        <Info label="Type" value={sectionField(patient, "providers", "Rendering Provider Type")} />
        <Info label="Doctor" value={sectionField(patient, "providers", "Rendering Provider Doctor")} />
        <Info label="Facility" value={sectionField(patient, "providers", "Rendering Provider Facility")} />
      </Section>

      <Section title="Referring Provider" icon={<Stethoscope className="h-5 w-5" />}>
        <Info label="Type" value={sectionField(patient, "providers", "Referring Provider Type")} />
        <Info label="Doctor" value={doctorName(patient, "Referring")} />
        <Info label="Facility" value={sectionField(patient, "providers", "Referring Provider Facility")} />
      </Section>

      <DiagnosisTable title="Diagnosis Codes - ICD-9" rows={[]} />
      <DiagnosisTable title="Diagnosis Codes - ICD-10" rows={diagnosisRows} />

      <Section title="EPSDT Referral" icon={<FileText className="h-5 w-5" />}>
        <Info label="Certification Condition Indicator" value={textField(patient.authorization, "epsdtCertificationIndicator")} />
        <Info label="Condition Code" value={textField(patient.authorization, "epsdtConditionCode")} />
      </Section>
    </>
  );
}

export function InsuranceTab({ patient }: { patient: PatientRecord }) {
  const payors = uniquePayors(patient);
  const [primary = "", secondary = "", tertiary = ""] = payors;

  return (
    <>
      {[
        ["Primary", primary],
        ["Secondary", secondary],
        ["Tertiary", tertiary],
      ].map(([level, payor]) => (
        <Section key={level} title={level} icon={<ShieldCheck className="h-5 w-5" />}>
          <Info label="Policy" value={payor} />
          <Info label="Policy #" value={payor ? policyValue(patient, payor, "policyNumber") || textField(patient.insurance, "policyNumber") : ""} />
          <Info label="Phone" value={textField(patient.insurance, `${level.toLowerCase()}Phone`)} />
          <Info label="Effective Date" value={formatDate(textField(patient.insurance, `${level.toLowerCase()}EffectiveDate`))} />
          <Info label="Verified" value={firstText(policyValue(patient, payor, "insuranceStatus"), textField(patient.insurance, "verified"))} />
          <Info label="Pay Pct" value={textField(patient.insurance, `${level.toLowerCase()}PayPct`)} />
          <Info label="Include This Payor Level On Sales Order" value={payor ? "Yes" : ""} />
        </Section>
      ))}

      <Section title="Verification" icon={<ClipboardCheck className="h-5 w-5" />}>
        <Info label="Coverage Verified" value={firstText(textField(patient.insurance, "verified"), textField(patient.insurance, "coverageVerified"))} />
      </Section>

      <Section title="Patient" icon={<UserRound className="h-5 w-5" />}>
        <Info label="Pay Pct" value={textField(patient.insurance, "patientPayPct")} />
        <Info label="Include this Payor Level on Sales Order" value={textField(patient.insurance, "includePatientPayor")} />
        <Info label="Wait for previous payor before billing" value={textField(patient.insurance, "waitForPreviousPayor")} />
      </Section>

      <Section title="Workers Compensation" icon={<ShieldCheck className="h-5 w-5" />}>
        <Info label="Date of Onset" value={formatDate(textField(patient.insurance, "dateOfOnset"))} />
        <Info label="Injury Related to Employment" value={textField(patient.insurance, "injuryEmployment")} />
        <Info label="Injury Related to Auto Accident" value={textField(patient.insurance, "injuryAuto")} />
        <Info label="State of Auto Accident" value={textField(patient.insurance, "autoAccidentState")} />
        <Info label="Injury Related to Other Accident" value={textField(patient.insurance, "injuryOther")} />
      </Section>

      <Section title="eClaims Attachment" icon={<FileText className="h-5 w-5" />}>
        <Info label="Include eClaims Attachment" value={textField(patient.insurance, "includeEclaimsAttachment")} />
        <Info label="Attachment Number" value={textField(patient.insurance, "attachmentNumber")} />
        <Info label="Type Code" value={textField(patient.insurance, "attachmentTypeCode")} />
        <Info label="Trans Code" value={textField(patient.insurance, "attachmentTransCode")} />
      </Section>
    </>
  );
}

export function PatientResponsibilityTab({ patient }: { patient: PatientRecord }) {
  const payors = uniquePayors(patient);
  const purchases = patient.purchasesLast90Days ?? [];
  const total = purchases.reduce((sum, item) => sum + numberField(item as unknown as Record<string, unknown>, "amount"), 0);

  return (
    <>
      <Section title="Payor Summary" icon={<ReceiptText className="h-5 w-5" />}>
        <div className="md:col-span-3">
          <div className={tables.wrapper}>
            <table className={tables.table}>
              <thead className={tables.head}>
                <tr>
                  <th className={tables.headCell}>Payor Level</th>
                  <th className={tables.headCell}>Payor</th>
                  <th className={tables.headCell}>Use Payor</th>
                </tr>
              </thead>
              <tbody className={tables.body}>
                {["Primary", "Secondary", "Tertiary"].map((level, index) => (
                  <tr key={level} className={tables.row}>
                    <td className={tables.cell}>{level}</td>
                    <td className={tables.cellStrong}>{payors[index] || "—"}</td>
                    <td className={tables.cell}>{payors[index] ? "True" : "False"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="Payor Responsibilities" icon={<Banknote className="h-5 w-5" />}>
        <Info label="Primary Deductible Remaining" value={formatMoney(textField(patient.insurance, "primaryDeductibleRemaining"))} />
        <Info label="Estimated Extended Amount" value={formatMoney(total)} />
        <Info label="Estimated Patient Responsibility" value={formatMoney(textField(patient.billing, "patientResponsibility"))} />
        <div className="md:col-span-3">
          <PurchaseTable items={purchases} />
        </div>
      </Section>
    </>
  );
}

export function ItemsTab({ patient }: { patient: PatientRecord }) {
  return (
    <>
      <Section title="Default Price Option Name" icon={<PackageCheck className="h-5 w-5" />}>
        <div className="md:col-span-3">
          <EquipmentTable items={patient.currentEquipment ?? []} />
        </div>
      </Section>

      <Section title="Purchased Items" icon={<ReceiptText className="h-5 w-5" />}>
        <div className="md:col-span-3">
          <PurchaseTable items={patient.purchasesLast90Days ?? []} />
        </div>
      </Section>
    </>
  );
}

export function ScheduleTab({
  patient,
  taskProps,
}: {
  patient: PatientRecord;
  taskProps: TaskProps;
}) {
  return (
    <>
      <Section title="Schedule" icon={<CalendarClock className="h-5 w-5" />}>
        <Info label="Status" value={firstText(textField(patient.deliverySummary, "scheduleStatus"), textField(patient.wip, "status"))} />
        <Info label="Prev. Run Date" value={formatDate(textField(patient.wip, "previousRunDate"))} />
        <Info label="Next Run Date" value={formatDate(textField(patient.wip, "nextRunDate"))} />
        <Info label="Enabled" value={textField(patient.wip, "enabled")} />
      </Section>

      <Section title="Care Coordination Tasks" icon={<ClipboardCheck className="h-5 w-5" />}>
        <PatientTasksSection {...taskProps} />
      </Section>
    </>
  );
}

export function MessagesTab({
  patient,
  notesProps,
}: {
  patient: PatientRecord;
  notesProps: NotesProps;
}) {
  const hasNotes = Boolean(
    notesProps.notesDraft ||
      notesProps.careNotesDraft ||
      notesProps.equipmentNotesDraft ||
      notesProps.billingNotesDraft
  );

  return (
    <>
      <Section title="Messages" icon={<MessageSquareText className="h-5 w-5" />}>
        <div className="md:col-span-3">
          {hasNotes ? (
            <p className={`${glass.insetPadded} ${typography.bodyStrong}`}>
              Internal chart notes are available below.
            </p>
          ) : (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="There are no outstanding messages"
              message="No indexed patient messages are attached to this digital record."
            />
          )}
        </div>
      </Section>

      <Section title="Internal Notes" icon={<MessageSquareText className="h-5 w-5" />}>
        <PatientNotesSection {...notesProps} />
      </Section>

      <Section title="Digital Chart Documents" icon={<FileText className="h-5 w-5" />}>
        <div className="md:col-span-3">
          <PatientDocumentsPanel patientId={patient.id} patientName={patient.fullName} />
        </div>
      </Section>
    </>
  );
}

export function CustomFieldsTab({ patient }: { patient: PatientRecord }) {
  const sourceFiles = Array.from(
    new Set(
      [
        ...(patient.currentEquipment ?? []).map((item) => item.sourceFileName),
        ...(patient.purchasesLast90Days ?? []).map((item) => item.sourceFileName),
      ]
        .map(cleanText)
        .filter(Boolean)
    )
  );

  return (
    <>
      <Section title="Custom Fields" icon={<FileText className="h-5 w-5" />}>
        <Info label="Patient ID" value={patient.patientId || patient.id} />
        <Info label="Brightree Status" value={textField(patient.profile, "patientStatus")} />
        <Info label="Hospice" value={patient.hospice ? "Yes" : "No"} />
        <Info label="Hospice Status" value={patient.hospiceStatus} />
        <Info label="Current Equipment Count" value={String(patient.currentEquipmentCount ?? patient.currentEquipment?.length ?? "")} />
        <Info label="Purchases Last 90 Days" value={String(patient.purchasesLast90DaysCount ?? patient.purchasesLast90Days?.length ?? "")} />
        <Info label="Last Activity" value={formatDate(patient.lastActivityDate)} />
        <Info label="Last Equipment" value={formatDate(patient.lastEquipmentDate)} />
      </Section>

      <Section title="Source Files" icon={<FileClock className="h-5 w-5" />}>
        <div className="md:col-span-3">
          {sourceFiles.length ? (
            <div className="flex flex-wrap gap-2">
              {sourceFiles.map((file) => (
                <span key={file} className={`${badges.neutral} rounded-full px-3 py-1 text-xs`}>
                  {file}
                </span>
              ))}
            </div>
          ) : (
            <p className={tables.empty}>No source filenames indexed.</p>
          )}
        </div>
      </Section>

      <PatientReportSources reportTypes={patient.reportTypes} />
      <Section title="Chart Export Readiness" icon={<FileText className="h-5 w-5" />}>
        <PatientExportReadinessSection patient={patient} />
      </Section>
    </>
  );
}

export function HistoryTab({ patient }: { patient: PatientRecord }) {
  return (
    <>
      <Section title="History" icon={<History className="h-5 w-5" />}>
        <PatientTimelineSection patientId={patient.id} />
      </Section>

      <PatientRetentionSection patient={patient} />
    </>
  );
}
