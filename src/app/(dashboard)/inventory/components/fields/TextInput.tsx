"use client";

import { useId } from "react";

import { forms, typography } from "@/theme";

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  list?: string;
  autoComplete?: string;
};

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  list,
  autoComplete = "off",
}: TextInputProps) {
  const inputId = useId();

  return (
    <div>
      <label htmlFor={inputId} className={`${typography.body} mb-2 block`}>
        {label}
      </label>

      <input
        id={inputId}
        type={type}
        value={value}
        required={required}
        title={label}
        aria-label={label}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        list={list}
        autoComplete={autoComplete}
        className={forms.input}
      />
    </div>
  );
}



