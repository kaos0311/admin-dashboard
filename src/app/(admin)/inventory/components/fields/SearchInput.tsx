"use client";

import { forms, typography } from "@/theme";
import { Search } from "lucide-react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative min-w-0">
      <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${typography.caption}`} />

      <input
        value={value}
        title="Search inventory"
        aria-label="Search inventory"
        placeholder="Name, barcode, lot, serial, SKU, or HCPCS..."
        onChange={(event) => onChange(event.target.value)}
        className={`${forms.inputIconLeft} min-w-0 w-full`}
      />
    </div>
  );
}
