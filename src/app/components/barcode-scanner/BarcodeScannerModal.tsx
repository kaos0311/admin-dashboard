"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine, ShieldCheck, Wifi, X } from "lucide-react";

import { buttons, glass, tiles, typography } from "@/theme";

import CameraScannerPanel from "./components/CameraScannerPanel";
import HardwareScannerPanel from "./components/HardwareScannerPanel";
import ManualScannerPanel from "./components/ManualScannerPanel";
import ScannerModeButton from "./components/ScannerModeButton";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";
import { useHardwareScanner } from "./hooks/useHardwareScanner";
import type { BarcodeScannerModalProps, ScannerMode } from "./types";
import { cleanBarcode, isValidBarcode } from "./utils/barcode-utils";

export default function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
  title = "Scan Barcode",
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hardwareInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const hasScannedRef = useRef(false);

  const [scannerMode, setScannerMode] = useState<ScannerMode>("camera");
  const [manualCode, setManualCode] = useState("");
  const [hardwareCode, setHardwareCode] = useState("");

  const handleDetectedOnce = useCallback(
    (value: string) => {
      const cleaned = cleanBarcode(value);

      if (!isValidBarcode(cleaned) || hasScannedRef.current) return;

      hasScannedRef.current = true;
      onDetected(cleaned);
      onClose();
    },
    [onClose, onDetected]
  );

  const {
    starting,
    cameraError,
    cameraEngine,
    setCameraError,
    startScanner,
    cleanupCameraOnly,
  } = useBarcodeScanner({
    videoRef,
    mountedRef,
    hasScannedRef,
    onDetected: handleDetectedOnce,
  });

  useHardwareScanner({
    enabled: open && scannerMode === "hardware",
    onDetected: handleDetectedOnce,
    setHardwareCode,
  });

  const cleanup = useCallback(() => {
    cleanupCameraOnly();
    setHardwareCode("");
  }, [cleanupCameraOnly]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    hasScannedRef.current = false;
    setManualCode("");
    setHardwareCode("");
    setCameraError("");

    if (scannerMode === "camera") {
      void startScanner();
    }

    if (scannerMode === "hardware") {
      cleanupCameraOnly();
      window.setTimeout(() => hardwareInputRef.current?.focus(), 100);
    }

    if (scannerMode === "manual") {
      cleanupCameraOnly();
    }

    return () => {
      cleanup();
    };
  }, [
    cleanup,
    cleanupCameraOnly,
    open,
    scannerMode,
    setCameraError,
    startScanner,
  ]);

  const closeModal = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const handleManualSubmit = useCallback(() => {
    const cleaned = cleanBarcode(manualCode);
    if (!isValidBarcode(cleaned)) return;

    handleDetectedOnce(cleaned);
  }, [handleDetectedOnce, manualCode]);

  const handleHardwareSubmit = useCallback(() => {
    const cleaned = cleanBarcode(hardwareCode);
    if (!isValidBarcode(cleaned)) return;

    handleDetectedOnce(cleaned);
  }, [handleDetectedOnce, hardwareCode]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div className={`w-full max-w-2xl overflow-hidden rounded-[2rem] ${glass.shell}`}>
        <div className={`border-b px-5 py-4 ${glass.toolbar}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={tiles.compact}>
                <ScanLine className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 id="barcode-scanner-title" className={typography.sectionTitle}>
                  {title}
                </h2>

                <p className={`mt-1 ${typography.bodyMuted}`}>
                  Camera, USB, Bluetooth, Wi-Fi, network scanner, or manual
                  entry.
                </p>

                <div className={`mt-2 inline-flex items-center gap-2 ${tiles.system}`}>
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  No scan history stored in this component
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className={buttons.secondary}
              aria-label="Close scanner"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={`border-b px-5 py-3 ${glass.divider}`}>
          <div className="grid grid-cols-3 gap-2">
            <ScannerModeButton
              active={scannerMode === "camera"}
              label="Camera"
              icon={<Camera className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setScannerMode("camera")}
            />

            <ScannerModeButton
              active={scannerMode === "hardware"}
              label="Scanner"
              icon={<Wifi className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setScannerMode("hardware")}
            />

            <ScannerModeButton
              active={scannerMode === "manual"}
              label="Manual"
              icon={<Keyboard className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setScannerMode("manual")}
            />
          </div>
        </div>

        <div className={`p-5 ${glass.inset}`}>
          {scannerMode === "camera" ? (
            <CameraScannerPanel
              videoRef={videoRef}
              starting={starting}
              cameraEngine={cameraEngine}
              cameraError={cameraError}
            />
          ) : null}

          {scannerMode === "hardware" ? (
            <HardwareScannerPanel
              inputRef={hardwareInputRef}
              hardwareCode={hardwareCode}
              setHardwareCode={setHardwareCode}
              onSubmit={handleHardwareSubmit}
            />
          ) : null}

          {scannerMode === "manual" ? (
            <ManualScannerPanel
              manualCode={manualCode}
              setManualCode={setManualCode}
              onSubmit={handleManualSubmit}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

