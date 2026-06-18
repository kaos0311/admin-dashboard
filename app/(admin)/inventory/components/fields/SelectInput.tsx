"use client";

import { useId } from "react";

import { humanize } from "../../lib/inventoryNormalize";
import { forms, typography } from "@/theme";

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
      <label htmlFor={selectId} className={`${typography.body} mb-2 block`}>
        {label}
      </label>

      <select
        id={selectId}
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={forms.select}
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



