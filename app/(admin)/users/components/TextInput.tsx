"use client";

import { useId } from "react";

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
};

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: TextInputProps) {
  const inputId = useId();

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>

      <input
        id={inputId}
        type={type}
        value={value}
        title={label}
        aria-label={label}
        placeholder={placeholder || label}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 transition focus:border-white/30 focus:bg-black/70"
      />
    </div>
  );
}