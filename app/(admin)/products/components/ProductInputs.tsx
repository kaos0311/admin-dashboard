"use client";

export function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  list,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  list?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-slate-200/80">
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        required={required}
        list={list}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-sky-300/50 focus:bg-white/[0.09]"
      />
    </div>
  );
}

export function SelectInput({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-slate-200/80">
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition focus:border-sky-300/50 focus:bg-white/[0.09]"
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

export function MiniSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const id = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs text-slate-400">
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-white shadow-inner shadow-black/20 outline-none backdrop-blur-xl transition focus:border-sky-300/50 focus:bg-white/[0.09]"
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

export function CheckboxInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-200 backdrop-blur-xl transition hover:bg-white/[0.08]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-sky-400"
      />
      {label}
    </label>
  );
}