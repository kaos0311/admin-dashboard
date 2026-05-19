"use client";

import { useId } from "react";

import { humanize } from "../../lib/inventoryNormalize";

type SelectInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

export function SelectInput({
  label,
  value,
  onChange,
  options,
}: SelectInputProps) {
  const selectId = useId();

  return (
    <div>
      <label htmlFor={selectId} className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <select
        id={selectId}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}