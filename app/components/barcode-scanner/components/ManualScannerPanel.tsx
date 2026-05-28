"use client";

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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-2">
          <Keyboard className="h-5 w-5 text-cyan-200" />
        </div>

        <div>
          <h3 className="font-semibold text-white">Manual Entry</h3>
          <p className="text-sm text-zinc-400">
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
        className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none backdrop-blur-xl placeholder:text-zinc-500 focus:border-cyan-300/50"
      />

      <button
        type="button"
        onClick={onSubmit}
        className="mt-3 rounded-2xl border border-white/10 bg-white px-4 py-2 font-semibold text-black shadow-lg shadow-black/30 transition hover:bg-zinc-200"
      >
        Submit
      </button>
    </section>
  );
}
