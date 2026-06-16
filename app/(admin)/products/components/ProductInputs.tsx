"use client";

import { forms, glass, typography } from "@/theme";

type Option = [value: string, label: string];

type TextInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  list?: string;
  placeholder?: string;
};

export function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  list,
  placeholder,
}: TextInputProps) {
  const isNumber = type === "number";

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={forms.label}
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        list={list}
        min={isNumber ? 0 : undefined}
        step={isNumber ? "0.01" : undefined}
        placeholder={placeholder ?? label}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={forms.input}
      />
    </div>
  );
}

type SelectInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
};

export function SelectInput({
  id,
  label,
  value,
  onChange,
  options,
}: SelectInputProps) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={forms.label}
      >
        {label}
      </label>

      <select
        id={id}
        name={id}
        title={label}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={forms.select}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

type MiniSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
};

export function MiniSelect({
  label,
  value,
  onChange,
  options,
}: MiniSelectProps) {
  const id = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={typography.caption}
      >
        {label}
      </label>

      <select
        id={id}
        name={id}
        title={label}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={forms.select}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

type CheckboxInputProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function CheckboxInput({
  label,
  checked,
  onChange,
}: CheckboxInputProps) {
  const id = `checkbox-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label
      htmlFor={id}
      className={`${glass.card} flex min-w-0 cursor-pointer items-center gap-3 px-4 py-3`}
    >
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-sky-400"
      />

      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}






