type ToggleRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        title={title}
        onClick={() => onChange(!checked)}
        className={[
          "relative mt-1 h-6 w-11 shrink-0 rounded-full border transition",
          checked
            ? "border-cyan-300/40 bg-cyan-300/70"
            : "border-white/10 bg-slate-800",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "left-5" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}