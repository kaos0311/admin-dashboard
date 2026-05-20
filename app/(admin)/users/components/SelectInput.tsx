"use client";

import { useId } from "react";

type SelectInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
      <label htmlFor={selectId} className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>

      <select
        id={selectId}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-black/70"
      >
        {options.map((option) => (
          <option key={`${selectId}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}