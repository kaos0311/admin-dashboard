"use client";

import { useId } from "react";
import { glassInput } from "@/app/(admin)/rentals/utils/rentalStyles";

type TextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: TextareaProps) {
  const textareaId = useId();

  return (
    <div>
      <label htmlFor={textareaId} className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <textarea
        id={textareaId}
        value={value}
        rows={4}
        title={label}
        aria-label={label}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
        className={`${glassInput} resize-none`}
      />
    </div>
  );
}