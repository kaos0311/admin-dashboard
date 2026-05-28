import { badgeClass } from "../hospice-utils";

export function HospiceBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
        value
      )}`}
    >
      {label}
    </span>
  );
}
