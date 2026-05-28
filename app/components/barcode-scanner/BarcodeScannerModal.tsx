"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine, ShieldCheck, Wifi, X } from "lucide-react";

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/80 shadow-2xl shadow-black/70 backdrop-blur-2xl">
        <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-inner">
                <ScanLine className="h-5 w-5 text-white" />
              </div>

              <div>
                <h2
                  id="barcode-scanner-title"
                  className="text-lg font-semibold text-white"
                >
                  {title}
                </h2>

                <p className="mt-1 text-sm leading-5 text-zinc-400">
                  Camera, USB, Bluetooth, Wi-Fi, network scanner, or manual
                  entry.
                </p>

                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  No scan history stored in this component
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="rounded-2xl border border-white/10 bg-white/[0.05] p-2 transition hover:bg-white/[0.1]"
              aria-label="Close scanner"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="border-b border-white/10 px-5 py-3">
          <div className="grid grid-cols-3 gap-2">
            <ScannerModeButton
              active={scannerMode === "camera"}
              label="Camera"
              icon={<Camera className="h-4 w-4" />}
              onClick={() => setScannerMode("camera")}
            />

            <ScannerModeButton
              active={scannerMode === "hardware"}
              label="Scanner"
              icon={<Wifi className="h-4 w-4" />}
              onClick={() => setScannerMode("hardware")}
            />

            <ScannerModeButton
              active={scannerMode === "manual"}
              label="Manual"
              icon={<Keyboard className="h-4 w-4" />}
              onClick={() => setScannerMode("manual")}
            />
          </div>
        </div>

        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.10),_transparent_35%)] p-5">
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
