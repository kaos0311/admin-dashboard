export function SelectField({
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
  options: { label: string; value: string }[];
}) {
  return (
    <div className="min-w-[180px]">
      <label
        htmlFor={id}
        className="mb-2 block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400"
      >
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm outline-none backdrop-blur-xl transition focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-black/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}