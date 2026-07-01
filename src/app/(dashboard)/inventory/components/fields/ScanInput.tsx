"use client";

import { useId } from "react";
import { Barcode } from "lucide-react";
import { buttons, forms, typography } from "@/theme";

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
      <label htmlFor={inputId} className={`${typography.body} mb-2 block`}>
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
          className={forms.input}
        />

        <button
          type="button"
          onClick={onScan}
          className={buttons.secondary}
          title={`Scan ${label}`}
          aria-label={`Scan ${label}`}
        >
          <Barcode className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}



