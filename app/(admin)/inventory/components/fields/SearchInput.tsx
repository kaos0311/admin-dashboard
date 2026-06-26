"use client";

import { colors, forms, typography } from "@/theme";
import { Search } from "lucide-react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative min-w-0">
      <Search className={`pointer-events-none absolute left-3 top-3.5 h-4 w-4 ${typography.caption}`} />

      <input
        value={value}
        title="Search inventory"
        aria-label="Search inventory"
        placeholder="Name, barcode, lot, serial, SKU, or HCPCS..."
        onChange={(event) => onChange(event.target.value)}
        className={`${forms.input} min-w-0 w-full bg-[#181818]/90 py-3 pl-10 pr-4 ${colors.textPrimary} placeholder:text-[#606060] shadow-inner shadow-black/20 backdrop-blur-xl focus:border-[#5a5a5a] focus:bg-[#1e1e1e]`}
      />
    </div>
  );
}



