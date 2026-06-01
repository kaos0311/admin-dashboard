"use client";

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
        className="mb-2 block text-sm font-medium text-slate-200/80"
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
        className="min-h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-white/[0.09] focus:ring-2 focus:ring-sky-300/20"
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
        className="mb-2 block text-sm font-medium text-slate-200/80"
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
        className="min-h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition focus:border-sky-300/50 focus:bg-slate-950/80 focus:ring-2 focus:ring-sky-300/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue} className="bg-slate-950">
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
        className="mb-2 block text-xs font-medium text-slate-400"
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
        className="min-h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition focus:border-sky-300/50 focus:bg-slate-950/80 focus:ring-2 focus:ring-sky-300/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue} className="bg-slate-950">
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
      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-200 backdrop-blur-xl transition hover:bg-white/[0.08]"
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


