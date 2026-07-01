"use client";

import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Edit3, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { buttons, glass, tiles, typography } from "@/theme";

import type {
  HospicePatient,
  HospiceRentalItem,
  HospiceStatus,
} from "../hospice-types";
import {
  HOSPICE_CONTRACT_PAYOR,
  hospiceRentalItemLabel,
  titleCase,
} from "../hospice-utils";

import { HospiceBadge } from "./HospiceBadges";

type HospicePatientCardProps = {
  patient: HospicePatient;
};

type InfoProps = {
  label: string;
  value?: string;
};

type ListBlockProps = {
  title: string;
  values: readonly string[];
  empty: string;
};

type EditableHospiceForm = {
  patientName: string;
  dateOfBirth: string;
  dateOfDeath: string;
  status: HospiceStatus;
  hospiceProvider: string;
  payor: string;
  nurseName: string;
  nursePhone: string;
  nextOfKin: string;
  phone: string;
  address: string;
  rentalItems: EditableRentalItem[];
  openIssues: string;
  notes: string;
};

type EditableRentalItem = {
  itemId: string;
  itemName: string;
  itemGroup: string;
  procCode: string;
  serialNumber: string;
  quantity: string;
  originalDos: string;
  nextDos: string;
  salesOrderId: string;
  salesOrderDetailId: string;
};

const MAX_VISIBLE_LIST_ITEMS = 8;

const STATUS_OPTIONS: { label: string; value: HospiceStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Living", value: "living" },
  { label: "Pending Pickup", value: "pending_pickup" },
  { label: "Discharged", value: "discharged" },
  { label: "Deceased", value: "deceased" },
  { label: "Unknown", value: "unknown" },
];

function toMultiline(values: readonly string[]): string {
  return values.join("\n");
}

function fromMultiline(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function toEditableRentalItem(
  item: HospiceRentalItem,
  index: number
): EditableRentalItem {
  return {
    itemId: item.itemId ?? "",
    itemName: item.itemName,
    itemGroup: item.itemGroup ?? "",
    procCode: item.procCode ?? item.hcpc ?? "",
    serialNumber: item.serialNumber ?? "",
    quantity: item.quantity ? String(item.quantity) : "",
    originalDos: item.originalDos ?? item.startDate ?? "",
    nextDos: item.nextDos ?? item.nextBillingDate ?? "",
    salesOrderId: item.salesOrderId ?? "",
    salesOrderDetailId: item.salesOrderDetailId ?? `manual-${index}`,
  };
}

function fallbackRentalItems(patient: HospicePatient): EditableRentalItem[] {
  if (patient.rentalItems.length > 0) {
    return patient.rentalItems.map(toEditableRentalItem);
  }

  return patient.equipment.map((itemName, index) =>
    toEditableRentalItem({ itemId: `manual-${index}`, itemName }, index)
  );
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== ""
    )
  ) as T;
}

function cleanRentalItems(items: readonly EditableRentalItem[]): HospiceRentalItem[] {
  return items
    .map((item, index): HospiceRentalItem | null => {
      const itemName = clean(item.itemName);

      if (!itemName) return null;

      const quantity = Number(item.quantity);
      const procCode = clean(item.procCode) ?? undefined;
      const originalDos = clean(item.originalDos) ?? undefined;
      const nextDos = clean(item.nextDos) ?? undefined;

      return compactObject({
        itemId: clean(item.itemId) ?? `manual-${index}`,
        itemName,
        itemGroup: clean(item.itemGroup) ?? undefined,
        procCode,
        hcpc: procCode,
        serialNumber: clean(item.serialNumber) ?? undefined,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
        originalDos,
        nextDos,
        startDate: originalDos,
        nextBillingDate: nextDos,
        salesOrderId: clean(item.salesOrderId) ?? undefined,
        salesOrderDetailId: clean(item.salesOrderDetailId) ?? undefined,
        status: "active_rental",
      });
    })
    .filter((item): item is HospiceRentalItem => Boolean(item));
}

function toPatientCurrentEquipment(items: readonly HospiceRentalItem[]) {
  return items.map((item) =>
    compactObject({
      itemId: item.itemId,
      itemName: item.itemName,
      hcpc: item.procCode || item.hcpc,
      category: item.itemGroup,
      saleType: "Rental",
      qty: item.quantity,
      serialNumber: item.serialNumber,
      status: item.status || "active_rental",
      startDate: item.originalDos || item.startDate,
      lastUpdated: new Date().toISOString(),
      sourceFileName: "Active Rentals",
      sourceReportId: item.salesOrderId,
      retrievalStatus:
        item.nextDos || item.nextBillingDate ? "scheduled" : undefined,
    })
  );
}

function buildInitialForm(patient: HospicePatient): EditableHospiceForm {
  return {
    patientName: patient.patientName,
    dateOfBirth: patient.dateOfBirth ?? "",
    dateOfDeath: patient.dateOfDeath ?? "",
    status: patient.status,
    hospiceProvider: patient.hospiceProvider || HOSPICE_CONTRACT_PAYOR,
    payor: patient.payor || HOSPICE_CONTRACT_PAYOR,
    nurseName: patient.nurseName ?? "",
    nursePhone: patient.nursePhone ?? "",
    nextOfKin: patient.nextOfKin ?? "",
    phone: patient.phone ?? "",
    address: patient.address ?? "",
    rentalItems: fallbackRentalItems(patient),
    openIssues: toMultiline(patient.openIssues),
    notes: patient.notes ?? "",
  };
}

function isActiveStatus(status: HospiceStatus): boolean {
  return ["active", "living", "pending_pickup"].includes(status);
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function buildSearchText(
  form: EditableHospiceForm,
  equipment: string[],
  openIssues: string[]
) {
  return [
    form.patientName,
    form.dateOfBirth,
    form.dateOfDeath,
    form.status,
    form.hospiceProvider,
    form.payor,
    form.nurseName,
    form.nursePhone,
    form.nextOfKin,
    form.phone,
    form.address,
    equipment.join(" "),
    openIssues.join(" "),
    form.notes,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function HospicePatientCard({ patient }: HospicePatientCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditableHospiceForm>(() =>
    buildInitialForm(patient)
  );

  const hiddenEquipmentCount = Math.max(
    Math.max(patient.rentalItems.length, patient.equipment.length) -
      MAX_VISIBLE_LIST_ITEMS,
    0
  );

  const hiddenRiskCount = Math.max(
    patient.riskReasons.length - MAX_VISIBLE_LIST_ITEMS,
    0
  );

  const editedRentalItems = useMemo(
    () => cleanRentalItems(form.rentalItems),
    [form.rentalItems]
  );
  const editedEquipment = useMemo(
    () => editedRentalItems.map(hospiceRentalItemLabel),
    [editedRentalItems]
  );
  const editedOpenIssues = useMemo(() => fromMultiline(form.openIssues), [form.openIssues]);

  function updateForm<TKey extends keyof EditableHospiceForm>(
    key: TKey,
    value: EditableHospiceForm[TKey]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function cancelEdit() {
    setForm(buildInitialForm(patient));
    setIsEditing(false);
  }

  function updateRentalItem(
    index: number,
    key: keyof EditableRentalItem,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      rentalItems: current.rentalItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function addRentalItem() {
    setForm((current) => ({
      ...current,
      rentalItems: [
        ...current.rentalItems,
        {
          itemId: "",
          itemName: "",
          itemGroup: "",
          procCode: "",
          serialNumber: "",
          quantity: "1",
          originalDos: "",
          nextDos: "",
          salesOrderId: "",
          salesOrderDetailId: `manual-${Date.now()}`,
        },
      ],
    }));
  }

  function removeRentalItem(index: number) {
    setForm((current) => ({
      ...current,
      rentalItems: current.rentalItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function saveEdit() {
    const patientName = clean(form.patientName);

    if (!patientName) {
      toast.error("Patient name is required.");
      return;
    }

    setIsSaving(true);

    const status: HospiceStatus = form.dateOfDeath.trim()
      ? "deceased"
      : form.status;
    const active = !form.dateOfDeath.trim() && isActiveStatus(status);
    const hospiceProvider = clean(form.hospiceProvider) || HOSPICE_CONTRACT_PAYOR;
    const payor = clean(form.payor) || HOSPICE_CONTRACT_PAYOR;
    const searchText = buildSearchText(
      { ...form, status, hospiceProvider, payor },
      editedEquipment,
      editedOpenIssues
    );
    const currentEquipment = toPatientCurrentEquipment(editedRentalItems);

    const hospiceUpdate = {
      patientKey: patient.id,
      patientId: clean(patient.patientId ?? ""),
      patientName,
      dob: clean(form.dateOfBirth),
      dateOfBirth: clean(form.dateOfBirth),
      dateOfDeath: clean(form.dateOfDeath),
      dod: clean(form.dateOfDeath),
      status,
      hospiceStatus: status,
      active,
      hospiceProvider,
      payor,
      insuranceName: payor,
      nurseName: clean(form.nurseName),
      nursePhone: clean(form.nursePhone),
      nextOfKin: clean(form.nextOfKin),
      phone: clean(form.phone),
      address: clean(form.address),
      equipment: editedEquipment,
      rentalItems: editedRentalItems,
      currentEquipment,
      currentEquipmentCount: currentEquipment.length,
      openIssues: editedOpenIssues,
      notes: clean(form.notes),
      searchText,
      manuallyEdited: true,
      manuallyEditedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const patientUpdate = {
      patientName,
      fullName: patientName,
      dob: clean(form.dateOfBirth),
      dateOfBirth: clean(form.dateOfBirth),
      dateOfDeath: clean(form.dateOfDeath),
      dod: clean(form.dateOfDeath),
      hospice: true,
      hospiceMarked: true,
      hospiceStatus: status,
      hospiceProvider,
      payor,
      insuranceName: payor,
      nurseName: clean(form.nurseName),
      nursePhone: clean(form.nursePhone),
      nextOfKin: clean(form.nextOfKin),
      phone: clean(form.phone),
      address: clean(form.address),
      equipment: editedEquipment,
      activeEquipment: editedEquipment,
      currentEquipment,
      currentEquipmentCount: currentEquipment.length,
      openIssues: editedOpenIssues,
      notes: clean(form.notes),
      searchText,
      updatedAt: serverTimestamp(),
    };

    try {
      await Promise.all([
        setDoc(doc(db, "hospicePatients", patient.id), hospiceUpdate, {
          merge: true,
        }),
        setDoc(doc(db, "patients", patient.id), patientUpdate, { merge: true }),
        setDoc(
          doc(db, "patients_index", patient.id),
          {
            patientName,
            fullName: patientName,
            dob: clean(form.dateOfBirth),
            dateOfBirth: clean(form.dateOfBirth),
            dateOfDeath: clean(form.dateOfDeath),
            dod: clean(form.dateOfDeath),
            hospice: true,
            hospiceMarked: true,
            hospiceStatus: status,
            phone: clean(form.phone),
            insuranceName: payor,
            activeEquipment: editedEquipment,
            currentEquipmentCount: currentEquipment.length,
            searchText,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      toast.success("Hospice patient record saved.");
      setIsEditing(false);
    } catch (error) {
      console.error("Could not save hospice patient record.", error);
      toast.error("Could not save hospice patient record.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className={`${glass.card} min-w-0 p-5 transition hover:border-sky-200/25 sm:p-6`}>
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <UserRound
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 ${typography.smallMuted}`}
            />

            {isEditing ? (
              <input
                className={`${glass.inputPadded} min-w-0 text-sm font-semibold`}
                value={form.patientName}
                onChange={(event) => updateForm("patientName", event.target.value)}
                aria-label="Patient name"
              />
            ) : (
              <h3 className={`${typography.cardTitle} min-w-0 break-words`}>
                {patient.patientName}
              </h3>
            )}
          </div>

          {isEditing ? (
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              <EditField
                label="DOB"
                value={form.dateOfBirth}
                onChange={(value) => updateForm("dateOfBirth", value)}
              />
              <EditField
                label="DOD"
                value={form.dateOfDeath}
                onChange={(value) => updateForm("dateOfDeath", value)}
              />
            </div>
          ) : (
            <>
              <p className={`${typography.caption} mt-1 break-words`}>
                DOB: {patient.dateOfBirth || "Missing"}
              </p>

              {patient.dateOfDeath ? (
                <p className={`${typography.caption} mt-1 break-words text-red-200`}>
                  DOD: {patient.dateOfDeath}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 md:items-end">
          <div
            aria-label="Patient status and risk"
            className="flex min-w-0 flex-wrap gap-2 md:justify-end"
          >
            {isEditing ? (
              <select
                className={`${glass.select} min-w-[160px]`}
                value={form.status}
                onChange={(event) =>
                  updateForm("status", event.target.value as HospiceStatus)
                }
                aria-label="Hospice status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <HospiceBadge
                value={patient.status}
                label={titleCase(patient.status)}
              />
            )}

            <HospiceBadge
              value={patient.riskLevel}
              label={`${titleCase(patient.riskLevel)} Risk`}
            />
          </div>

          <div className="flex min-w-0 flex-wrap gap-2 md:justify-end">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className={buttons.compactSuccess}
                  onClick={saveEdit}
                  disabled={isSaving}
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  {isSaving ? "Saving" : "Save"}
                </button>

                <button
                  type="button"
                  className={buttons.compactSecondary}
                  onClick={cancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={buttons.compactSecondary}
                onClick={() => {
                  setForm(buildInitialForm(patient));
                  setIsEditing(true);
                }}
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`${tiles.compact} mt-5 min-w-0 overflow-visible border-cyan-300/20 bg-cyan-300/10`}>
        <p className={`${typography.label} break-words`}>
          Contract Hospice Provider / Payor
        </p>
        {isEditing ? (
          <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
            <EditField
              label="Provider"
              value={form.hospiceProvider}
              onChange={(value) => updateForm("hospiceProvider", value)}
            />
            <EditField
              label="Payor"
              value={form.payor}
              onChange={(value) => updateForm("payor", value)}
            />
          </div>
        ) : (
          <p className={`${typography.bodyStrong} mt-1 break-words`}>
            {patient.hospiceProvider || patient.payor || HOSPICE_CONTRACT_PAYOR}
          </p>
        )}
      </div>

      <div className="mt-4 grid min-w-0 gap-4 text-sm md:grid-cols-2">
        {isEditing ? (
          <>
            <EditField
              label="Assigned Nurse"
              value={form.nurseName}
              onChange={(value) => updateForm("nurseName", value)}
            />
            <EditField
              label="Nurse Phone"
              value={form.nursePhone}
              onChange={(value) => updateForm("nursePhone", value)}
            />
            <EditField
              label="Next of Kin"
              value={form.nextOfKin}
              onChange={(value) => updateForm("nextOfKin", value)}
            />
            <EditField
              label="Patient Phone"
              value={form.phone}
              onChange={(value) => updateForm("phone", value)}
            />
          </>
        ) : (
          <>
            <Info label="Assigned Nurse" value={patient.nurseName} />
            <Info label="Nurse Phone" value={patient.nursePhone} />
            <Info label="Next of Kin" value={patient.nextOfKin} />
            <Info label="Patient Phone" value={patient.phone} />
          </>
        )}
      </div>

      {isEditing ? (
        <EditArea
          label="Address"
          value={form.address}
          onChange={(value) => updateForm("address", value)}
          className="mt-3"
          rows={2}
        />
      ) : patient.address ? (
        <InfoBlock label="Address" value={patient.address} className="mt-3" />
      ) : null}

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        {isEditing ? (
          <>
            <EquipmentEditor
              items={form.rentalItems}
              onAdd={addRentalItem}
              onChange={updateRentalItem}
              onRemove={removeRentalItem}
            />
            <EditArea
              label="Risk / Open Issues"
              value={form.openIssues}
              onChange={(value) => updateForm("openIssues", value)}
              placeholder="One issue per line"
            />
          </>
        ) : (
          <>
            <EquipmentList
              equipment={patient.equipment}
              rentalItems={patient.rentalItems}
              hiddenCount={hiddenEquipmentCount}
            />

            <ListBlock
              title="Risk Flags"
              values={patient.riskReasons}
              empty="No risk flags"
              hiddenCount={hiddenRiskCount}
            />
          </>
        )}
      </div>

      {isEditing ? (
        <EditArea
          label="Notes"
          value={form.notes}
          onChange={(value) => updateForm("notes", value)}
          className="mt-4"
          placeholder="Care notes, pickup context, or follow-up details"
        />
      ) : patient.notes ? (
        <section
          aria-label="Patient notes"
          className={`${tiles.compact} ${typography.bodyMuted} mt-4 min-w-0 overflow-visible`}
        >
          <p className="break-words">{patient.notes}</p>
        </section>
      ) : null}

      <footer className={`mt-4 flex min-w-0 flex-wrap justify-between gap-2 border-t border-white/10 pt-3 ${typography.caption}`}>
        <span className="min-w-0 break-words">
          Source: {patient.source || "Unknown"}
        </span>

        <span className="min-w-0 break-words">
          Updated: {patient.lastUpdated || "Unknown"}
        </span>
      </footer>
    </article>
  );
}

function Info({ label, value }: InfoProps) {
  return <InfoBlock label={label} value={value || "Missing"} />;
}

function InfoBlock({
  label,
  value,
  className = "",
}: InfoProps & {
  className?: string;
}) {
  return (
    <div className={`${tiles.compact} min-w-0 overflow-visible ${className}`}>
      <p className={`${typography.label} break-words`}>
        {label}
      </p>

      <p className={`${typography.bodyMuted} mt-1 break-words`}>
        {value}
      </p>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <span className={`${typography.label} mb-1 block break-words`}>
        {label}
      </span>
      <input
        className={`${glass.inputPadded} min-w-0 text-sm`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EditArea({
  label,
  value,
  onChange,
  className = "",
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={`${typography.label} mb-1 block break-words`}>
        {label}
      </span>
      <textarea
        className={`${glass.textarea} min-h-0 resize-y text-sm`}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EquipmentEditor({
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  items: readonly EditableRentalItem[];
  onAdd: () => void;
  onChange: (
    index: number,
    key: keyof EditableRentalItem,
    value: string
  ) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className={`${tiles.compact} min-w-0 overflow-visible`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className={`${typography.label} break-words`}>
          Current Rental Equipment
        </p>

        <button
          type="button"
          className={buttons.compactSecondary}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className={`${typography.bodyMuted} mt-3 break-words`}>
          No equipment listed.
        </p>
      ) : (
        <div className="mt-3 grid min-w-0 gap-3">
          {items.map((item, index) => (
            <div
              key={`${item.salesOrderDetailId || item.itemName}-${index}`}
              className="min-w-0 rounded-md border border-white/10 bg-slate-950/35 p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <EditField
                  label="Equipment Name"
                  value={item.itemName}
                  onChange={(value) => onChange(index, "itemName", value)}
                />

                <button
                  type="button"
                  className={`${buttons.iconDanger} mt-5`}
                  onClick={() => onRemove(index)}
                  aria-label="Remove equipment item"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                <EditField
                  label="Proc Code"
                  value={item.procCode}
                  onChange={(value) => onChange(index, "procCode", value)}
                />
                <EditField
                  label="Serial"
                  value={item.serialNumber}
                  onChange={(value) => onChange(index, "serialNumber", value)}
                />
                <EditField
                  label="Group"
                  value={item.itemGroup}
                  onChange={(value) => onChange(index, "itemGroup", value)}
                />
                <EditField
                  label="Qty"
                  value={item.quantity}
                  onChange={(value) => onChange(index, "quantity", value)}
                />
                <EditField
                  label="Original DOS"
                  value={item.originalDos}
                  onChange={(value) => onChange(index, "originalDos", value)}
                />
                <EditField
                  label="Next DOS"
                  value={item.nextDos}
                  onChange={(value) => onChange(index, "nextDos", value)}
                />
                <EditField
                  label="Sales Order"
                  value={item.salesOrderId}
                  onChange={(value) => onChange(index, "salesOrderId", value)}
                />
                <EditField
                  label="Detail ID"
                  value={item.salesOrderDetailId}
                  onChange={(value) =>
                    onChange(index, "salesOrderDetailId", value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EquipmentList({
  equipment,
  rentalItems,
  hiddenCount,
}: {
  equipment: readonly string[];
  rentalItems: readonly HospiceRentalItem[];
  hiddenCount: number;
}) {
  const visibleItems = rentalItems.slice(0, MAX_VISIBLE_LIST_ITEMS);

  if (visibleItems.length === 0) {
    return (
      <ListBlock
        title="Equipment"
        values={equipment}
        empty="No equipment listed"
        hiddenCount={hiddenCount}
      />
    );
  }

  return (
    <section className={`${tiles.compact} min-w-0 overflow-visible`}>
      <p className={`${typography.label} break-words`}>
        Current Rental Equipment
      </p>

      <div className="mt-3 grid min-w-0 gap-3">
        {visibleItems.map((item, index) => (
          <div
            key={`${item.salesOrderDetailId || item.itemName}-${index}`}
            className="min-w-0 rounded-md border border-white/10 bg-slate-950/30 p-3"
          >
            <p className={`${typography.bodyStrong} break-words`}>
              {item.itemName}
            </p>

            <div className="mt-2 grid min-w-0 gap-2 text-xs sm:grid-cols-2">
              <EquipmentMeta label="Proc" value={item.procCode || item.hcpc} />
              <EquipmentMeta label="Serial" value={item.serialNumber} />
              <EquipmentMeta label="Group" value={item.itemGroup} />
              <EquipmentMeta
                label="Qty"
                value={item.quantity ? String(item.quantity) : undefined}
              />
              <EquipmentMeta
                label="Original DOS"
                value={item.originalDos || item.startDate}
              />
              <EquipmentMeta
                label="Next DOS"
                value={item.nextDos || item.nextBillingDate}
              />
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <p className={`${typography.caption} mt-3`}>
          +{hiddenCount} more equipment item(s)
        </p>
      ) : null}
    </section>
  );
}

function EquipmentMeta({ label, value }: InfoProps) {
  return (
    <p className="min-w-0 break-words">
      <span className={typography.label}>{label}: </span>
      <span className={typography.bodyMuted}>{value || "Missing"}</span>
    </p>
  );
}

function ListBlock({
  title,
  values,
  empty,
  hiddenCount = 0,
}: ListBlockProps & {
  hiddenCount?: number;
}) {
  const visibleValues = values.slice(0, MAX_VISIBLE_LIST_ITEMS);

  return (
    <section className={`${tiles.compact} min-w-0 overflow-visible`}>
      <p className={`${typography.label} break-words`}>
        {title}
      </p>

      {visibleValues.length === 0 ? (
        <p className={`${typography.bodyMuted} mt-2 break-words`}>
          {empty}
        </p>
      ) : (
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          {visibleValues.map((value) => (
            <span
              key={value}
              title={value}
              className={tiles.tag}
            >
              {value}
            </span>
          ))}

          {hiddenCount > 0 ? (
            <span className={tiles.tagMuted}>
              +{hiddenCount} more
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}
