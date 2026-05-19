"use client";

import { useId } from "react";
import { Barcode } from "lucide-react";

type ScanInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
};

export function ScanInput({
  label,
  value,
  onChange,
  onScan,
}: ScanInputProps) {
  const inputId = useId();

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <div className="flex gap-2">
        <input
          id={inputId}
          value={value}
          title={label}
          aria-label={label}
          placeholder={label}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55"
        />

        <button
          type="button"
          onClick={onScan}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-white/15"
          title={`Scan ${label}`}
          aria-label={`Scan ${label}`}
        >
          <Barcode className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}