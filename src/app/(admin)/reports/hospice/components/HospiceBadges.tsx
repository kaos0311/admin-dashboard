import { uploadUi } from "@/theme";

import { badgeClass } from "../hospice-utils";

type HospiceBadgeProps = {
  value: string;
  label: string;
};

export function HospiceBadge({ value, label }: HospiceBadgeProps) {
  const badgeStyles = badgeClass(value);

  return (
    <span
      aria-label={label}
      className={`${uploadUi.badge} min-w-0 max-w-full ${badgeStyles}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
