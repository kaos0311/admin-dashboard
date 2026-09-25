"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { patientEquipmentWorkflow, type PatientEquipmentWorkflowRequest } from "@/lib/domainWorkflows";
import { buttons, glass, typography } from "@/theme";

import type { CurrentEquipmentItem, PatientRecord } from "../patient-detail-types";

type EquipmentAction = PatientEquipmentWorkflowRequest["action"];

const ACTIONS: Array<{ value: EquipmentAction; label: string; requiresReason: boolean; confirm: boolean }> = [
  { value: "assign", label: "Assign equipment", requiresReason: false, confirm: false },
  { value: "remove", label: "Remove assignment", requiresReason: false, confirm: false },
  { value: "transfer", label: "Transfer to patient", requiresReason: true, confirm: true },
  { value: "replace", label: "Replace equipment", requiresReason: true, confirm: true },
  { value: "lost", label: "Mark lost", requiresReason: true, confirm: true },
  { value: "damaged", label: "Mark damaged", requiresReason: true, confirm: true },
  { value: "return_to_warehouse", label: "Return to warehouse", requiresReason: false, confirm: false },
  { value: "recover_deceased", label: "Deceased-patient recovery", requiresReason: true, confirm: true },
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferredInventoryId(item: CurrentEquipmentItem | undefined): string {
  return clean(item?.itemId);
}

function isActiveLike(status: string): boolean {
  return !["returned", "removed", "transferred", "lost", "retired"].includes(status.toLowerCase());
}

function validActionsFor(item: CurrentEquipmentItem | undefined): EquipmentAction[] {
  const status = clean(item?.status) || "active";
  if (!item) return ["assign"];
  if (!isActiveLike(status)) return status === "lost" ? ["recover_deceased"] : [];
  return ["remove", "transfer", "replace", "lost", "damaged", "return_to_warehouse", "recover_deceased"];
}

export function PatientEquipmentWorkflowPanel({ patient }: { patient: PatientRecord }) {
  const router = useRouter();
  const equipment = patient.currentEquipment ?? [];
  const [selectedIndex, setSelectedIndex] = useState("");
  const selectedItem = selectedIndex ? equipment[Number(selectedIndex)] : undefined;
  const [action, setAction] = useState<EquipmentAction>("assign");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [replacementInventoryItemId, setReplacementInventoryItemId] = useState("");
  const [toPatientId, setToPatientId] = useState("");
  const [toPatientName, setToPatientName] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const validActions = useMemo(() => validActionsFor(selectedItem), [selectedItem]);
  const selectedAction = ACTIONS.find((item) => item.value === action) ?? ACTIONS[0];
  const requiresTarget = action === "transfer";
  const requiresReplacement = action === "replace";
  const canSubmit =
    Boolean(inventoryItemId.trim()) &&
    (!selectedAction.requiresReason || Boolean(reason.trim())) &&
    (!requiresTarget || Boolean(toPatientId.trim())) &&
    (!requiresReplacement || Boolean(replacementInventoryItemId.trim())) &&
    !saving;

  function applySelectedEquipment(index: string) {
    setSelectedIndex(index);
    const item = index ? equipment[Number(index)] : undefined;
    setInventoryItemId(inferredInventoryId(item));
    setAction(validActionsFor(item)[0] ?? "assign");
    setMessage("");
  }

  async function submit() {
    if (!canSubmit) return;
    if (selectedAction.confirm) {
      const confirmed = window.confirm(`Run ${selectedAction.label.toLowerCase()} for ${inventoryItemId.trim()}?`);
      if (!confirmed) return;
    }

    setSaving(true);
    setMessage("");

    try {
      const result = await patientEquipmentWorkflow({
        operationId: `patient-equipment-${action}-${patient.id}-${inventoryItemId.trim()}-${Date.now()}`,
        action,
        patientId: patient.id,
        patientName: patient.fullName,
        inventoryItemId: inventoryItemId.trim(),
        replacementInventoryItemId: replacementInventoryItemId.trim() || undefined,
        toPatientId: toPatientId.trim() || undefined,
        toPatientName: toPatientName.trim() || undefined,
        productId: clean(selectedItem?.itemId),
        serialNumber: clean(selectedItem?.serialNumber),
        lotNumber: clean(selectedItem?.lotNumber),
        quantity: selectedItem?.qty ?? 1,
        reason: reason.trim() || undefined,
      });

      if (result.status !== "success" && result.status !== "duplicate_operation") {
        throw new Error(result.message || "Patient equipment workflow failed.");
      }

      setMessage(result.status === "duplicate_operation" ? "Operation was already applied." : "Equipment workflow completed.");
      setReason("");
      setReplacementInventoryItemId("");
      setToPatientId("");
      setToPatientName("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete equipment workflow.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${glass.insetPadded} space-y-4`}>
      <div>
        <h3 className={typography.cardTitle}>Equipment Operations</h3>
        <p className={`${typography.smallMuted} mt-1`}>
          Workflow-owned equipment actions commit through the server ledger and audit trail.
        </p>
      </div>

      {message ? <p className={`${glass.inset} text-sm`}>{message}</p> : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <label className="block">
          <span className={typography.smallMuted}>Current equipment</span>
          <select
            value={selectedIndex}
            onChange={(event) => applySelectedEquipment(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
          >
            <option value="">Manual / new assignment</option>
            {equipment.map((item, index) => (
              <option key={`${item.itemName}-${item.serialNumber}-${index}`} value={String(index)}>
                {item.itemName || "Equipment"} · {item.serialNumber || item.itemId || "no id"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={typography.smallMuted}>Action</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as EquipmentAction)}
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
          >
            {ACTIONS.filter((item) => validActions.includes(item.value)).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={typography.smallMuted}>Inventory item ID</span>
          <input
            value={inventoryItemId}
            onChange={(event) => setInventoryItemId(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
            placeholder="inventory/{id}"
          />
        </label>

        {requiresTarget ? (
          <>
            <label className="block">
              <span className={typography.smallMuted}>Target patient ID</span>
              <input
                value={toPatientId}
                onChange={(event) => setToPatientId(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className={typography.smallMuted}>Target patient name</span>
              <input
                value={toPatientName}
                onChange={(event) => setToPatientName(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
              />
            </label>
          </>
        ) : null}

        {requiresReplacement ? (
          <label className="block">
            <span className={typography.smallMuted}>Replacement inventory ID</span>
            <input
              value={replacementInventoryItemId}
              onChange={(event) => setReplacementInventoryItemId(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
            />
          </label>
        ) : null}

        <label className="block lg:col-span-3">
          <span className={typography.smallMuted}>Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
            placeholder={selectedAction.requiresReason ? "Required for this action" : "Optional"}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="button" className={buttons.primary} onClick={submit} disabled={!canSubmit}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Run Workflow
        </button>
      </div>
    </div>
  );
}
