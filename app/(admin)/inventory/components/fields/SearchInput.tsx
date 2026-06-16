"use client";

import { typography } from "@/theme";
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
        className="min-w-0 w-full rounded-2xl border border-white/10 bg-black/45 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55"
      />
    </div>
  );
}



