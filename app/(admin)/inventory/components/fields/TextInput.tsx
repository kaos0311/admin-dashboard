"use client";

import { useId } from "react";

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
};

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
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
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55"
      />
    </div>
  );
}