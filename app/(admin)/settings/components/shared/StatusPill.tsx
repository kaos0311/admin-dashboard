import { badges } from "@/theme";

type StatusPillProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const tones = {
    neutral: badges.neutral,
    success: badges.success,
    warning: badges.warning,
    danger: badges.danger,
  };

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
