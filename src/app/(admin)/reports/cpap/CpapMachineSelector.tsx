"use client";

import { useCallback, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ChevronDown, Cpu, Save } from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { buttons, glass, typography } from "@/theme";

import { addTimelineEntry } from "../patients/lib/patientActions";

const MACHINE_OPTIONS = [
  { value: "ResMed AirSense 10", label: "ResMed AirSense 10" },
  { value: "ResMed AirSense 11", label: "ResMed AirSense 11" },
  { value: "ResMed AirCurve 10 VAuto", label: "ResMed AirCurve 10 VAuto (BiPAP)" },
] as const;

export type CpapMachineSelection = (typeof MACHINE_OPTIONS)[number]["value"];

type CpapMachineSelectorProps = {
  patientId: string;
  patientName: string;
  currentMachine?: string;
  onSaved?: (value: string) => void;
};

export function CpapMachineSelector({
  patientId,
  patientName,
  currentMachine,
  onSaved,
}: CpapMachineSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [machine, setMachine] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMachine, setSavedMachine] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!machine) {
      toast.error("Select a machine before saving.");
      return;
    }

    setSaving(true);

    try {
      const cpapUpdate = {
        "cpap.machine": machine,
        "cpap.machineUpdatedAt": new Date().toISOString(),
        "cpap.machineUpdatedBy": auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      };

      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, cpapUpdate);

      await addTimelineEntry({
        patientId,
        type: "cpap_machine_updated",
        title: `CPAP machine updated to ${machine}`,
        body: "",
      });

      setSavedMachine(machine);
      setExpanded(false);
      onSaved?.(machine);

      toast.success(`${patientName} — machine saved to digital record.`);
    } catch (err) {
      console.error("SAVE CPAP MACHINE ERROR:", err);
      toast.error("Could not save machine selection. Check Firestore permissions.");
    } finally {
      setSaving(false);
    }
  }, [machine, patientId, patientName, onSaved]);

  const displayValue = savedMachine ?? (currentMachine || "Not set");

  return (
    <div className={glass.insetPadded}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={typography.caption}>Machine Type</p>
          <p className={cx(typography.bodyStrong, "mt-0.5 break-words")}>
            {displayValue}
          </p>
          {savedMachine ? (
            <p className={cx(typography.smallMuted, "mt-0.5")}>Saved to digital record</p>
          ) : null}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className={buttons.secondary}
        >
          <Cpu className="h-4 w-4" />
          {expanded ? "Close" : savedMachine ? "Change" : "Set Machine"}
          <ChevronDown
            className={cx(
              "h-4 w-4 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className={cx(typography.caption, "mb-1 block")}>
              CPAP / BiPAP Machine
            </label>
            <select
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              title="CPAP / BiPAP Machine"
              className={cx(
                glass.inputPadded,
                "w-full cursor-pointer appearance-none",
              )}
            >
              <option value="">Select machine…</option>
              {MACHINE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setMachine("");
              }}
              className={buttons.ghost}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !machine}
              className={buttons.primary}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save to Digital Record"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
