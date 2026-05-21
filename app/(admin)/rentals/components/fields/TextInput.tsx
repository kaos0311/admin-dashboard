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
    <label className="block" htmlFor={id}>
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>

      <input
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
      />
    </label>
  );
}