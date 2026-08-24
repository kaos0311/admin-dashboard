"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ChevronDown, PackageCheck, Save } from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { buttons, glass, typography } from "@/theme";

import {
  CPAP_MASK_DATA,
  getMaskByName,
  getUniqueManufacturers,
  type MaskSelection,
} from "./cpapMaskData";
import { addTimelineEntry } from "../patients/lib/patientActions";

type CpapMaskSelectorProps = {
  patientId: string;
  patientName: string;
  currentMaskType?: string;
  currentMachine?: string;
  onSaved?: (selection: MaskSelection) => void;
};

export function CpapMaskSelector({
  patientId,
  patientName,
  currentMaskType,
  currentMachine: _currentMachine,
  onSaved,
}: CpapMaskSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [manufacturer, setManufacturer] = useState("");
  const [mask, setMask] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSelection, setSavedSelection] = useState<MaskSelection | null>(null);

  // Derive available masks from the selected manufacturer
  const availableMasks = manufacturer
    ? CPAP_MASK_DATA.filter((e) => e.manufacturer === manufacturer)
    : [];
  const selectedEntry = manufacturer && mask ? getMaskByName(manufacturer, mask) : null;

  // Attempt to pre-fill based on current mask type text
  useEffect(() => {
    if (!currentMaskType || manufacturer || mask) return;

    const name = currentMaskType.toLowerCase().trim();
    const match = CPAP_MASK_DATA.find(
      (e) =>
        e.mask.toLowerCase().includes(name) ||
        name.includes(e.mask.toLowerCase()),
    );

    if (match) {
      setManufacturer(match.manufacturer);
      setMask(match.mask);
    }
  }, [currentMaskType, manufacturer, mask]);

  const handleSave = useCallback(async () => {
    if (!manufacturer || !mask) {
      toast.error("Select a manufacturer and mask before saving.");
      return;
    }

    setSaving(true);

    try {
      const entry = getMaskByName(manufacturer, mask);

      if (!entry) {
        toast.error("Invalid mask selection.");
        setSaving(false);
        return;
      }

      const selection: MaskSelection = {
        manufacturer: entry.manufacturer,
        mask: entry.mask,
        cushion: entry.cushion,
        headgear: entry.headgear,
      };

      // Build the cpap data to merge
      const cpapUpdate = {
        "cpap.maskManufacturer": selection.manufacturer,
        "cpap.maskName": selection.mask,
        "cpap.maskType": entry.maskType,
        "cpap.maskCushion": selection.cushion,
        "cpap.maskHeadgear": selection.headgear,
        "cpap.maskUpdatedAt": new Date().toISOString(),
        "cpap.maskUpdatedBy": auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      };

      // Update the patient document in Firestore
      const patientRef = doc(db, "patients", patientId);
      await updateDoc(patientRef, cpapUpdate);

      // Add a timeline entry
      await addTimelineEntry({
        patientId,
        type: "cpap_mask_updated",
        title: `CPAP mask updated to ${selection.manufacturer} ${selection.mask}`,
        body: `Cushion: ${selection.cushion} | Headgear: ${selection.headgear}`,
      });

      setSavedSelection(selection);
      setExpanded(false);
      onSaved?.(selection);

      toast.success(`${patientName} — mask saved to digital record.`);
    } catch (err) {
      console.error("SAVE CPAP MASK ERROR:", err);
      toast.error("Could not save mask selection. Check Firestore permissions.");
    } finally {
      setSaving(false);
    }
  }, [manufacturer, mask, patientId, patientName, onSaved]);

  const hasSaved = savedSelection !== null;
  const summary = hasSaved
    ? `${savedSelection.manufacturer} · ${savedSelection.mask}`
    : currentMaskType || "Not set";

  return (
    <div className={glass.insetPadded}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={typography.caption}>Mask Equipment</p>
          <p className={cx(typography.bodyStrong, "mt-0.5 break-words")}>
            {summary}
          </p>
          {hasSaved ? (
            <p className={cx(typography.smallMuted, "mt-0.5")}>
              {savedSelection.cushion} · {savedSelection.headgear}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className={buttons.secondary}
        >
          <PackageCheck className="h-4 w-4" />
          {expanded ? "Close" : hasSaved ? "Change" : "Set Mask"}
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
          {/* Manufacturer dropdown */}
          <div>
            <label className={cx(typography.caption, "mb-1 block")}>
              Manufacturer
            </label>
            <select
              value={manufacturer}
              onChange={(e) => {
                setManufacturer(e.target.value);
                setMask("");
              }}
              title="Manufacturer"
              className={cx(
                glass.inputPadded,
                "w-full cursor-pointer appearance-none",
              )}
            >
              <option value="">Select manufacturer…</option>
              {getUniqueManufacturers().map((mfr) => (
                <option key={mfr} value={mfr}>
                  {mfr}
                </option>
              ))}
            </select>
          </div>

          {/* Mask model dropdown - only when manufacturer is selected */}
          {manufacturer ? (
            <div>
              <label className={cx(typography.caption, "mb-1 block")}>
                Mask Model
              </label>
              <select
                value={mask}
                onChange={(e) => setMask(e.target.value)}
                title="Mask Model"
                className={cx(
                  glass.inputPadded,
                  "w-full cursor-pointer appearance-none",
                )}
              >
                <option value="">Select mask model…</option>
                {availableMasks.map((m) => (
                  <option key={m.mask} value={m.mask}>
                    {m.mask} — {m.maskType}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Preview of selected cushion + headgear */}
          {selectedEntry ? (
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <div className={glass.insetPadded}>
                <p className={typography.caption}>Cushion</p>
                <p className={cx(typography.bodyStrong, "mt-0.5 break-words")}>
                  {selectedEntry.cushion}
                </p>
              </div>
              <div className={glass.insetPadded}>
                <p className={typography.caption}>Headgear</p>
                <p className={cx(typography.bodyStrong, "mt-0.5 break-words")}>
                  {selectedEntry.headgear}
                </p>
              </div>
            </div>
          ) : null}

          {/* Save button */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setManufacturer("");
                setMask("");
              }}
              className={buttons.ghost}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !manufacturer || !mask}
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

// Inline cx utility so this file has no extra dependencies
function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
