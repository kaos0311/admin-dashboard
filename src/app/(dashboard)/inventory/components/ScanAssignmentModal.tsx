"use client";

import { useMemo, useState } from "react";
import { ScanLine } from "lucide-react";

import { buttons, colors, glass, tiles, typography } from "@/theme";

export type ScanAssignmentChoice = "serial" | "barcodeSku" | "lotNumber" | "next" | "none";

type ScanTarget = "serial" | "lotNumber" | "barcode" | "scanIn" | "scanOut" | null;

type ScanAssignmentModalProps = {
  open: boolean;
  code: string;
  itemName?: string;
  saving: boolean;
  target: ScanTarget;
  onClose: () => void;
  onConfirm: (choice: ScanAssignmentChoice) => Promise<void> | void;
};

export function ScanAssignmentModal({
  open,
  code,
  itemName,
  saving,
  target,
  onClose,
  onConfirm,
}: ScanAssignmentModalProps) {
  const showLotOption = target === "lotNumber";
  const showSerialOption = target === null || target === "serial";
  const defaultChoice: ScanAssignmentChoice = showLotOption
    ? "lotNumber"
    : showSerialOption
      ? "serial"
      : "barcodeSku";

  const [choice, setChoice] = useState<ScanAssignmentChoice>(defaultChoice);
  const [inProgress, setInProgress] = useState(false);

  const title = useMemo(() => itemName?.trim() || "Scanned Item", [itemName]);

  if (!open) return null;

  async function handleConfirm() {
    const resolved: ScanAssignmentChoice = choice === "lotNumber" && !showLotOption
      ? "barcodeSku"
      : choice === "serial" && !showSerialOption
        ? "barcodeSku"
        : choice;

    setInProgress(true);
    try {
      await onConfirm(resolved);
    } finally {
      setInProgress(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-assignment-title"
    >
      <section className={`${glass.panel} w-full max-w-lg p-5 sm:p-6`}>
        <div className="flex items-start gap-3">
          <span className={tiles.compact}>
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="scan-assignment-title" className={typography.sectionTitle}>
              Assign Scanned Code
            </h2>
            <p className={`${typography.bodyMuted} mt-1`}>
              {title}
            </p>
            <p className={`${typography.body} mt-2 break-all font-mono text-sm`}>
              {code}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <span className={typography.formLabel}>Choose what this scan represents.</span>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {showSerialOption ? (
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
                  choice === "serial"
                    ? `${colors.surfaceHover} border-white/20`
                    : "border-white/10"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">Serial</p>
                  <p className={`${typography.smallMuted} text-xs`}>
                    Attach this scan to the equipment serial.
                  </p>
                </div>
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={choice === "serial"}
                  onChange={() => setChoice("serial")}
                />
              </label>
            ) : null}

            {showLotOption ? (
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
                  choice === "lotNumber"
                    ? `${colors.surfaceHover} border-white/20`
                    : "border-white/10"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">Lot Number</p>
                  <p className={`${typography.smallMuted} text-xs`}>
                    Attach this scan to the lot number.
                  </p>
                </div>
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={choice === "lotNumber"}
                  onChange={() => setChoice("lotNumber")}
                />
              </label>
            ) : (
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
                  choice === "barcodeSku"
                    ? `${colors.surfaceHover} border-white/20`
                    : "border-white/10"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">SKU / Barcode</p>
                  <p className={`${typography.smallMuted} text-xs`}>
                    Attach this scan to SKU or barcode.
                  </p>
                </div>
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={choice === "barcodeSku"}
                  onChange={() => setChoice("barcodeSku")}
                />
              </label>
            )}

            <label
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
                choice === "next"
                  ? `${colors.surfaceHover} border-white/20`
                  : "border-white/10"
              }`}
              title="Keep scanning the same power of attorney for this equipment?"
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">Next equipment</p>
                <p className={`${typography.smallMuted} text-xs`}>
                  Skip this code and continue scanning the same equipment.
                </p>
              </div>
              <input
                type="radio"
                className="h-4 w-4"
                checked={choice === "next"}
                onChange={() => setChoice("next")}
              />
            </label>

            <label
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
                choice === "none"
                  ? `${colors.surfaceHover} border-white/20`
                  : "border-white/10"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">No Serial / No Barcode</p>
                <p className={`${typography.smallMuted} text-xs`}>
                  Save without this scan so the form is not blocked.
                </p>
              </div>
              <input
                type="radio"
                className="h-4 w-4"
                checked={choice === "none"}
                onChange={() => setChoice("none")}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className={buttons.secondary}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={inProgress || saving}
            className={buttons.primary}
          >
            {inProgress || saving ? (
              <span className="inline-flex items-center gap-2">
                <ScanLine className="h-4 w-4 animate-pulse" aria-hidden="true" />
                Applying...
              </span>
            ) : (
              "Apply"
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
