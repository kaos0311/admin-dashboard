"use client";

import { colors, forms, surfaces, typography } from "@/theme";

import { Keyboard } from "lucide-react";

type ManualScannerPanelProps = {
  manualCode: string;
  setManualCode: (value: string) => void;
  onSubmit: () => void;
};

export default function ManualScannerPanel({
  manualCode,
  setManualCode,
  onSubmit,
}: ManualScannerPanelProps) {
  return (
    <section className={`${surfaces.cardPadded} rounded-[2rem] shadow-2xl shadow-black/30 backdrop-blur-xl`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-2xl border ${colors.info} p-2`}>
          <Keyboard className={`h-5 w-5 ${colors.textInfo}`} />
        </div>

        <div>
          <h3 className={typography.cardTitle}>Manual Entry</h3>
          <p className={typography.bodyMuted}>
            Type or paste a barcode value.
          </p>
        </div>
      </div>

      <label className="sr-only" htmlFor="manual-barcode-input">
        Manual barcode input
      </label>

      <input
        id="manual-barcode-input"
        type="text"
        value={manualCode}
        onChange={(event) => setManualCode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder="Enter barcode manually..."
        autoComplete="off"
        spellCheck={false}
        className={`${forms.input} w-full bg-[#181818]/90 px-4 py-3 ${colors.textPrimary} placeholder:text-[#606060] focus:border-[#7a9a5e]/50`}
      />

      <button
        type="button"
        onClick={onSubmit}
        className={`mt-3 rounded-2xl border ${colors.border} ${colors.surface} px-4 py-2 font-semibold ${colors.textPrimary} shadow-lg shadow-black/30 transition ${colors.surfaceHover}`}
      >
        Submit
      </button>
    </section>
  );
}






