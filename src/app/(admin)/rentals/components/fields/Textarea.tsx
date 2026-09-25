import { colors, forms, typography } from "@/theme";
import type { ChangeEvent } from "react";

type TextareaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
};

export function Textarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
}: TextareaProps) {
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className={`block truncate text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}>
        {label}
        {required ? <span className={colors.textDanger}> *</span> : null}
      </span>

      <textarea
        id={id}
        name={id}
        value={value}
        required={required}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
        className={`mt-2 min-h-28 ${forms.textareaCompact}`}
      />
    </label>
  );
}
