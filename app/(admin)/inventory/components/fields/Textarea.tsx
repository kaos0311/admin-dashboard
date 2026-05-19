"use client";

import { useId } from "react";

type TextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function Textarea({ label, value, onChange }: TextareaProps) {
  const textareaId = useId();

  return (
    <div>
      <label htmlFor={textareaId} className="mb-2 block text-sm text-slate-300">
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
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55"
      />
    </div>
  );
}