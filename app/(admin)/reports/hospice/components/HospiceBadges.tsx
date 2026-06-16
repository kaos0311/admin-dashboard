import { badgeClass } from "../hospice-utils";

type HospiceBadgeProps = {
  value: string;
  label: string;
};

export function HospiceBadge({
  value,
  label,
}: HospiceBadgeProps) {
  const badgeStyles = badgeClass(value);

  return (
    <span
      aria-label={label}
      className={`inline-flex min-w-0 max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold leading-5 ${badgeStyles}`}
    >
      <span className="truncate">
        {label}
      </span>
    </span>
  );
}



