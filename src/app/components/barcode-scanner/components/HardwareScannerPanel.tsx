"use client";

import { colors, forms, surfaces, typography } from "@/theme";

import type { RefObject } from "react";
import { Wifi } from "lucide-react";

type HardwareScannerPanelProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  hardwareCode: string;
  setHardwareCode: (value: string) => void;
  onSubmit: () => void;
};

export default function HardwareScannerPanel({
  inputRef,
  hardwareCode,
  setHardwareCode,
  onSubmit,
}: HardwareScannerPanelProps) {
  return (
    <section className={`${surfaces.cardPadded} rounded-[2rem] shadow-2xl shadow-black/30 backdrop-blur-xl`}>
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-2xl border ${colors.success} p-2`}>
          <Wifi className={`h-5 w-5 ${colors.textSuccess}`} />
        </div>

        <div>
          <h3 className={typography.cardTitle}>External Scanner Mode</h3>
          <p className={typography.bodyMuted}>
            USB, Bluetooth, Wi-Fi, or network scanner configured as keyboard
            input.
          </p>
        </div>
      </div>

      <label className="sr-only" htmlFor="hardware-barcode-input">
        Hardware scanner barcode input
      </label>

      <input
        id="hardware-barcode-input"
        ref={inputRef}
        type="text"
        value={hardwareCode}
        onChange={(event) => setHardwareCode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder="Scan here..."
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className={`${forms.input} w-full bg-[#181818]/90 px-4 py-3 ${colors.textPrimary} placeholder:text-[#606060] focus:border-[#6a9a6a]/50`}
      />

      <button
        type="button"
        onClick={onSubmit}
        className={`mt-3 rounded-2xl border ${colors.border} ${colors.surface} px-4 py-2 font-semibold ${colors.textPrimary} shadow-lg shadow-black/30 transition ${colors.surfaceHover}`}
      >
        Submit Scan
      </button>

      <p className={`mt-4 text-xs leading-5 ${colors.textFaint}`}>
        Most external scanners behave like keyboards and send the barcode,
        usually followed by Enter. Primitive, reliable, and somehow still
        better than half of modern software.
      </p>
    </section>
  );
}






