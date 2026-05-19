"use client";

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
};

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: FilterSelectProps) {
  return (
    <select
      title={label}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none shadow-inner shadow-black/20 backdrop-blur-xl transition focus:border-white/30 focus:bg-black/55"
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}