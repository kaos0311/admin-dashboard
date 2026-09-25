import { colors, forms, typography } from "@/theme";
import type { ChangeEvent } from "react";

type TextInputProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

export function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete = "off",
  required = false,
}: TextInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className={`block truncate text-xs font-medium uppercase tracking-[0.16em] ${typography.bodyMuted}`}>
        {label}
        {required ? <span className={colors.textDanger}> *</span> : null}
      </span>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-label={label}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        className={`mt-2 ${forms.input}`}
      />
    </label>
  );
}
