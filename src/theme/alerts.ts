import { surfaces } from "./surfaces";

export const alerts = {
  info: surfaces.alertInfo,

  success: surfaces.alertSuccess,

  warning: surfaces.alertWarning,

  danger: surfaces.alertDanger,
} as const;

export type AlertKey = keyof typeof alerts;
