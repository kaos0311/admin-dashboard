import { typography } from "@/theme";
﻿import type { ChangeEvent } from "react";

type SelectOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type SelectFieldProps<TValue extends string> = {
  id: string;
  label: string;
  value: TValue;
  options: SelectOption<TValue>[];
  onChange: (value: TValue) => void;
  required?: boolean;
};

export function SelectField<TValue extends string>({
  id,
  label,
  value,
  options,
  onChange,
  required = false,
}: SelectFieldProps<TValue>) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value as TValue);
  }

  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className={`block truncate text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}>
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>

      <select
        id={id}
        name={id}
        value={value}
        required={required}
        onChange={handleChange}
        aria-label={label}
        className="mt-2 h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-slate-950"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}



