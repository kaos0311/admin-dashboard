import { colors, metricActionButtonClass, tiles, typography } from "@/theme";

export function SummaryCard({
  label,
  value,
  tone = "blue",
  onClick,
}: {
  label: string;
  value: number;
  tone?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className={tiles.metricLabel} title={label}>{label}</p>
      <p className={["mt-3", typography.metric].join(" ")}>{value.toLocaleString()}</p>

      {onClick ? (
        <span className={metricActionButtonClass(tone)}>
          Open
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[10.75rem] min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={[tiles.base, tiles.compact, colors.surfaceInset, "min-h-[10.75rem]"].join(" ")}>
      {content}
    </div>
  );
}
