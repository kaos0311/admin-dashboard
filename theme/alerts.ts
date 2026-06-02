import { glass } from "./glass";

export const alerts = {
  info: glass.alertInfo,

  success: glass.alertSuccess,

  warning: glass.alertWarning,

  danger: glass.alertDanger,
} as const;

export type AlertKey = keyof typeof alerts;
