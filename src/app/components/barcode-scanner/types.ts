import type { ReactNode } from "react";

export type ScannerMode = "camera" | "hardware" | "manual";

export type CameraEngine = "idle" | "native" | "zxing";

export type BarcodeScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
};

export type ScannerModeButtonProps = {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};


