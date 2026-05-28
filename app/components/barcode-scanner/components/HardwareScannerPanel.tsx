"use client";

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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-2">
          <Wifi className="h-5 w-5 text-emerald-200" />
        </div>

        <div>
          <h3 className="font-semibold text-white">External Scanner Mode</h3>
          <p className="text-sm text-zinc-400">
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
        className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none backdrop-blur-xl placeholder:text-zinc-500 focus:border-emerald-300/50"
      />

      <button
        type="button"
        onClick={onSubmit}
        className="mt-3 rounded-2xl border border-white/10 bg-white px-4 py-2 font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-zinc-200"
      >
        Submit Scan
      </button>

      <p className="mt-4 text-xs leading-5 text-zinc-500">
        Most external scanners behave like keyboards and send the barcode,
        usually followed by Enter. Primitive, reliable, and somehow still
        better than half of modern software.
      </p>
    </section>
  );
}
