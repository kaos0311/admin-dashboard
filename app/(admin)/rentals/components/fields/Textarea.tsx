import type { ChangeEvent } from "react";

type TextareaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function Textarea({
  id,
  label,
  value,
  onChange,
  placeholder,
}: TextareaProps) {
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="block" htmlFor={id}>
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>

      <textarea
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
      />
    </label>
  );
}