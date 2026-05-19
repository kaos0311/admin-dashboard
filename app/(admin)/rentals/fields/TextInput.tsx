"use client";

import { useId } from "react";
import { glassInput } from "@/app/(admin)/rentals/utils/rentalStyles";

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
};

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: TextInputProps) {
  const inputId = useId();

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <input
        id={inputId}
        type={type}
        value={value}
        required={required}
        title={label}
        aria-label={label}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
        className={glassInput}
      />
    </div>
  );
}