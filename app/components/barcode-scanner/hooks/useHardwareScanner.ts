"use client";

import { useEffect, useRef } from "react";
import { cleanBarcode } from "../utils/barcode-utils";

type UseHardwareScannerParams = {
  enabled: boolean;
  onDetected: (code: string) => void;
  setHardwareCode: (value: string) => void;
};

export function useHardwareScanner({
  enabled,
  onDetected,
  setHardwareCode,
}: UseHardwareScannerParams) {
  const hardwareBufferRef = useRef("");
  const hardwareTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function clearHardwareTimer() {
      if (hardwareTimerRef.current !== null) {
        window.clearTimeout(hardwareTimerRef.current);
        hardwareTimerRef.current = null;
      }
    }

    function flushBuffer(minLength = 1) {
      const cleaned = cleanBarcode(hardwareBufferRef.current);

      hardwareBufferRef.current = "";
      setHardwareCode("");

      if (cleaned.length >= minLength) {
        onDetected(cleaned);
      }
    }

    function handleGlobalScannerInput(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "Enter") {
        clearHardwareTimer();
        flushBuffer(1);
        return;
      }

      if (event.key.length !== 1) return;

      hardwareBufferRef.current += event.key;
      setHardwareCode(hardwareBufferRef.current);

      clearHardwareTimer();

      hardwareTimerRef.current = window.setTimeout(() => {
        flushBuffer(4);
      }, 180);
    }

    window.addEventListener("keydown", handleGlobalScannerInput);

    return () => {
      window.removeEventListener("keydown", handleGlobalScannerInput);
      clearHardwareTimer();
      hardwareBufferRef.current = "";
      setHardwareCode("");
    };
  }, [enabled, onDetected, setHardwareCode]);
}


