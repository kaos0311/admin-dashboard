"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Barcode, CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";

import { useBarcodeScanner, type UseBarcodeScannerOptions } from "@/hooks/useBarcodeScanner";
import { buttons, glass, tiles, typography } from "@/theme";

export interface BarcodeScannerInputHandle {
  focusScanner: () => void;
}

export interface BarcodeScannerInputProps {
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Label for accessibility. */
  label?: string;
  /** Called when a barcode is successfully scanned. */
  onScan: (barcode: string) => void;
  /** Whether the scanner is disabled. */
  disabled?: boolean;
  /** Whether to show visual scan status indicators. */
  showStatus?: boolean;
  /** Whether to show the manual submit button. */
  showSubmitButton?: boolean;
  /** Whether to auto-focus the input on mount. */
  autoFocus?: boolean;
  /** Callback when input is cleared. */
  onClear?: () => void;
  /** Optional CSS class name. */
  className?: string;
  /** Scanner hook options. */
  scannerOptions?: Omit<UseBarcodeScannerOptions, "onScan" | "globalKeyCapture">;
  /** Enable audio feedback on successful scan. */
  audioFeedback?: boolean;
}

export const BarcodeScannerInput = forwardRef<BarcodeScannerInputHandle, BarcodeScannerInputProps>(
  function BarcodeScannerInput({
    placeholder = "Scan or type barcode...",
    label = "Barcode scanner",
    onScan,
    disabled = false,
    showStatus = true,
    showSubmitButton = true,
    autoFocus = true,
    onClear,
    className = "",
    scannerOptions,
    audioFeedback = false,
  }: BarcodeScannerInputProps,
  ref
) {
  const [manualValue, setManualValue] = useState("");
  const [scanState, setScanState] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioEnabledRef = useRef(audioFeedback);

  const handleScan = useCallback(
    (barcode: string) => {
      setManualValue("");
      setScanState("success");
      setStatusMessage(`Scanned: ${barcode}`);

      if (audioEnabledRef.current) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.15;
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        } catch {
          // Audio not available
        }
      }

      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => {
        setScanState("idle");
        setStatusMessage("");
      }, 2000);

      onScan(barcode);
    },
    [onScan]
  );

  const {
    inputRef,
    isReady,
    isProcessing,
    focusScanner,
  } = useBarcodeScanner({
    onScan: handleScan,
    globalKeyCapture: false,
    ...scannerOptions,
  });

  // Expose focusScanner to parent via ref
  useImperativeHandle(ref, () => ({
    focusScanner,
  }), [focusScanner]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const timer = setTimeout(() => focusScanner(), 300);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled, focusScanner]);

  useEffect(() => {
    audioEnabledRef.current = audioFeedback;
  }, [audioFeedback]);

  const handleManualSubmit = useCallback(() => {
    const value = manualValue.trim();
    if (!value) return;
    handleScan(value);
  }, [handleScan, manualValue]);

  const handleManualKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleManualSubmit();
      }
    },
    [handleManualSubmit]
  );

  const handleClear = useCallback(() => {
    setManualValue("");
    setScanState("idle");
    setStatusMessage("");
    focusScanner();
    onClear?.();
  }, [focusScanner, onClear]);

  // Cleanup status timer
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const statusColor =
    scanState === "success"
      ? "text-green-500"
      : scanState === "error"
        ? "text-red-500"
        : "text-[var(--color-accent)]";

  const statusIcon =
    scanState === "success" ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : scanState === "error" ? (
      <XCircle className="h-5 w-5 text-red-500" />
    ) : (
      <ScanLine className={`h-5 w-5 ${isReady ? "animate-pulse" : ""}`} />
    );

  return (
    <div className={`${glass.panel} ${className}`}>
      <div className="p-4 sm:p-5">
        <label htmlFor="barcode-scanner-input" className="sr-only">
          {label}
        </label>

        {/* Status indicator */}
        {showStatus && (
          <div className="mb-3 flex items-center gap-2">
            <div className={`${tiles.compact} ${statusColor}`}>
              {statusIcon}
            </div>
            <div className="min-w-0">
              <p className={`${typography.bodyStrong} truncate`}>
                {scanState === "success"
                  ? "Scan successful"
                  : scanState === "error"
                    ? "Scan failed"
                    : isReady
                      ? "Scanner ready"
                      : "Initializing scanner..."}
              </p>
              {statusMessage && (
                <p className={`${typography.smallMuted} truncate`}>
                  {statusMessage}
                </p>
              )}
            </div>
            {isProcessing && (
              <Loader2 className="ml-auto h-4 w-4 animate-spin text-[var(--color-accent)]" />
            )}
          </div>
        )}

        {/* Input */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Barcode className={`h-5 w-5 ${isReady ? "text-[var(--color-accent)]" : "text-gray-500"}`} />
          </div>
          <input
            ref={inputRef}
            id="barcode-scanner-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={handleManualKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={`${glass.input} w-full py-3 pl-10 pr-20 text-lg font-mono tracking-wider
              ${scanState === "success" ? "ring-2 ring-green-500/50" : ""}
              ${scanState === "error" ? "ring-2 ring-red-500/50" : ""}
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={label}
            aria-describedby="scanner-status"
          />
          {manualValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-14 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Clear input"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Submit button */}
        {showSubmitButton && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={disabled || !manualValue.trim()}
              className={`${buttons.primary} flex-1`}
            >
              <Barcode className="h-4 w-4" />
              Submit Barcode
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className={buttons.secondary}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
