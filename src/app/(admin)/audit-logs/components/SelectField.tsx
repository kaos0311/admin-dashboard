import { forms, typography } from "@/theme";
﻿export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="min-w-[180px]">
      <label
        htmlFor={id}
        className={`mb-2 block text-xs uppercase tracking-[0.15em] ${typography.caption} dark:${typography.bodyMuted}`}
      >
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={forms.select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}



