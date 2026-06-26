import { buttons, colors, surfaces, typography } from "@/theme";

export function pageWrapClass(): string {
  return ["space-y-6 p-4 sm:p-5 lg:p-6", colors.textPrimary].join(" ");
}

export function pageTitleClass(): string {
  return typography.pageTitle;
}

export function pageSubtitleClass(): string {
  return ["mt-1", typography.bodyMuted].join(" ");
}

export function cardClass(): string {
  return ["p-5", surfaces.card].join(" ");
}

export function innerCardClass(): string {
  return ["p-4", surfaces.inset].join(" ");
}

export function mutedPanelClass(): string {
  return ["border-dashed p-6", typography.bodyMuted, surfaces.inset].join(" ");
}

export function errorPanelClass(): string {
  return surfaces.alertDanger;
}

export function successPanelClass(): string {
  return surfaces.alertSuccess;
}

export function warningPanelClass(): string {
  return surfaces.alertWarning;
}

export function statPillClass(): string {
  return surfaces.chip;
}

export function labelClass(): string {
  return ["mb-2 block", typography.formLabel].join(" ");
}

export function inputClass(): string {
  return ["text-sm", surfaces.inputPadded].join(" ");
}

export function selectClass(): string {
  return ["text-sm", surfaces.select].join(" ");
}

export function textareaClass(): string {
  return ["text-sm", surfaces.textarea].join(" ");
}

export function tableWrapperClass(): string {
  return ["overflow-hidden", surfaces.card].join(" ");
}

export function tableScrollClass(): string {
  return "admin-scroll overflow-x-auto";
}

export function tableHeadClass(): string {
  return [
    "text-left",
    "text-xs",
    "font-semibold",
    "uppercase",
    "tracking-[0.14em]",
    colors.textFaint,
  ].join(" ");
}

export function tableCellClass(): string {
  return ["px-4 py-4", typography.body].join(" ");
}

export function tableRowClass(): string {
  return surfaces.tableRow;
}

export function rowSurfaceClass(): string {
  return surfaces.inset;
}

export function primaryButtonClass(): string {
  return buttons.primary;
}

export function secondaryButtonClass(): string {
  return buttons.secondary;
}

export function dangerButtonClass(): string {
  return buttons.danger;
}

export function successButtonClass(): string {
  return buttons.success;
}

export function statusBadgeClass(
  tone: "blue" | "amber" | "green" | "red" | "zinc"
): string {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

  switch (tone) {
    case "blue":
      return [base, colors.infoBadge].join(" ");

    case "amber":
      return [base, colors.warningBadge].join(" ");

    case "green":
      return [base, colors.successBadge].join(" ");

    case "red":
      return [base, colors.dangerBadge].join(" ");

    default:
      return [base, colors.neutralBadge].join(" ");
  }
}
