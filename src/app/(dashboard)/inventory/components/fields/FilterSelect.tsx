"use client";

import { forms } from "@/theme";

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
};

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: FilterSelectProps) {
  return (
    <select
      title={label}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${forms.select} min-w-0`}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}



