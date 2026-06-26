"use client";

import { useId } from "react";

import { forms, typography } from "@/theme";

type TextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function Textarea({ label, value, onChange }: TextareaProps) {
  const textareaId = useId();

  return (
    <div>
      <label htmlFor={textareaId} className={`${typography.body} mb-2 block`}>
        {label}
      </label>

      <textarea
        id={textareaId}
        value={value}
        rows={3}
        title={label}
        aria-label={label}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        className={forms.textareaCompact}
      />
    </div>
  );
}



