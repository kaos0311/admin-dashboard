"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeBarcode } from "@/lib/barcode";

export interface UseBarcodeScannerOptions {
  /** How long to wait (ms) after the last keystroke before treating the buffer as complete. */
  scanTimeout?: number;
  /** Minimum buffer length to auto-submit on timeout. */
  minBufferLength?: number;
  /** Minimum interval (ms) between accepted scans to suppress duplicates. */
  duplicateSuppressionMs?: number;
  /** Called when a barcode is successfully scanned. */
  onScan?: (barcode: string) => void;
  /** Enable global key capture. Only safe on a dedicated scanning page. */
  globalKeyCapture?: boolean;
}

export interface UseBarcodeScannerReturn {
  /** The latest successfully scanned, normalized barcode value. */
  scannedValue: string;
  /** Whether the scanner input is ready and listening. */
  isReady: boolean;
  /** Whether a scan is currently being processed. */
  isProcessing: boolean;
  /** Data about the last completed scan. */
  lastScan: {
    rawValue: string;
    normalizedValue: string;
    timestamp: number;
  } | null;
  /** Error message if the last scan failed. */
  error: string | null;
  /** Programmatically submit a barcode value. */
  submitScan: (value: string) => void;
  /** Reset scanner state. */
  resetScanner: () => void;
  /** Focus the scanner input element. */
  focusScanner: () => void;
  /** Ref to attach to the input element. */
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const DEFAULT_SCAN_TIMEOUT = 150;
const DEFAULT_MIN_BUFFER_LENGTH = 3;
const DEFAULT_DUPLICATE_SUPPRESSION_MS = 2000;

/**
 * Hook for capturing barcode scanner HID keyboard input.
 *
 * Scanners in USB HID keyboard mode emit keystrokes rapidly followed by Enter.
 * This hook buffers keystrokes and flushes on Enter or a configurable timeout.
 */
export function useBarcodeScanner(
  options?: UseBarcodeScannerOptions
): UseBarcodeScannerReturn {
  const {
    scanTimeout = DEFAULT_SCAN_TIMEOUT,
    minBufferLength = DEFAULT_MIN_BUFFER_LENGTH,
    duplicateSuppressionMs = DEFAULT_DUPLICATE_SUPPRESSION_MS,
    onScan,
    globalKeyCapture = false,
  } = options ?? {};

  const inputRef = useRef<HTMLInputElement | null>(null);
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanTimeRef = useRef(0);
  const lastScanValueRef = useRef("");
  const processingRef = useRef(false);

  const [scannedValue, setScannedValue] = useState("");
  const [isReady, setIsReady] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScan, setLastScan] = useState<UseBarcodeScannerReturn["lastScan"]>(null);
  const [error, setError] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushBuffer = useCallback(
    (source: "enter" | "timeout") => {
      const raw = bufferRef.current;
      bufferRef.current = "";

      if (!raw || raw.length < minBufferLength) return;

      const normalized = normalizeBarcode(raw);
      if (!normalized) return;

      clearTimer();

      // Duplicate suppression
      const now = Date.now();
      if (
        normalized === lastScanValueRef.current &&
        now - lastScanTimeRef.current < duplicateSuppressionMs
      ) {
        return;
      }

      lastScanValueRef.current = normalized;
      lastScanTimeRef.current = now;

      setScannedValue(normalized);
      setLastScan({
        rawValue: raw,
        normalizedValue: normalized,
        timestamp: now,
      });
      setError(null);
      processingRef.current = false;
      setIsProcessing(false);

      onScan?.(normalized);
    },
    [clearTimer, duplicateSuppressionMs, minBufferLength, onScan]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't intercept if a modifier is held (shortcuts)
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // Ignore if a focusable element other than our input is active
      // (unless global capture is explicitly enabled)
      if (!globalKeyCapture) {
        const active = document.activeElement;
        if (active && active !== inputRef.current && active.tagName !== "BODY") {
          // Allow scanner input in the dedicated input, but not global
          return;
        }
      }

      if (event.key === "Enter") {
        event.preventDefault();
        flushBuffer("enter");
        return;
      }

      // Single printable character
      if (event.key.length === 1) {
        event.preventDefault();
        bufferRef.current += event.key;
        clearTimer();
        timerRef.current = setTimeout(() => flushBuffer("timeout"), scanTimeout);
      }
    },
    [clearTimer, flushBuffer, globalKeyCapture, scanTimeout]
  );

  const submitScan = useCallback(
    (value: string) => {
      const normalized = normalizeBarcode(value);
      if (!normalized) {
        setError("Invalid barcode value");
        return;
      }

      // Duplicate suppression
      const now = Date.now();
      if (
        normalized === lastScanValueRef.current &&
        now - lastScanTimeRef.current < duplicateSuppressionMs
      ) {
        return;
      }

      lastScanValueRef.current = normalized;
      lastScanTimeRef.current = now;

      setIsProcessing(true);
      setScannedValue(normalized);
      setLastScan({
        rawValue: value,
        normalizedValue: normalized,
        timestamp: now,
      });
      setError(null);
      processingRef.current = false;
      setIsProcessing(false);

      onScan?.(normalized);
    },
    [duplicateSuppressionMs, onScan]
  );

  const resetScanner = useCallback(() => {
    bufferRef.current = "";
    clearTimer();
    setScannedValue("");
    setLastScan(null);
    setError(null);
    setIsProcessing(false);
    setIsReady(true);
  }, [clearTimer]);

  const focusScanner = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!globalKeyCapture) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [globalKeyCapture, handleKeyDown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    scannedValue,
    isReady,
    isProcessing,
    lastScan,
    error,
    submitScan,
    resetScanner,
    focusScanner,
    inputRef,
  };
}
