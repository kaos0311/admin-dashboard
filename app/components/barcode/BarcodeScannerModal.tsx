"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine, Wifi, X } from "lucide-react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";

import {
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";
import toast from "react-hot-toast";

type ScannerMode = "camera" | "hardware" | "manual";

type BarcodeScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect: (
          source: CanvasImageSource
        ) => Promise<Array<{ rawValue?: string }>>;
      };
    };
  }
}

const NATIVE_FORMATS = [
  "aztec",
  "codabar",
  "code_39",
  "code_93",
  "code_128",
  "data_matrix",
  "ean_8",
  "ean_13",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
];

const ZXING_FORMATS = [
  BarcodeFormat.AZTEC,
  BarcodeFormat.CODABAR,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODE_128,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.ITF,
  BarcodeFormat.MAXICODE,
  BarcodeFormat.PDF_417,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.RSS_14,
  BarcodeFormat.RSS_EXPANDED,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.UPC_EAN_EXTENSION,
];

function cleanBarcode(value: string): string {
  return value.replace(/[\r\n\t]+/g, "").trim();
}

export default function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
  title = "Scan Barcode",
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hardwareInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorIntervalRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const hasScannedRef = useRef(false);
  const hardwareBufferRef = useRef("");
  const hardwareTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const [scannerMode, setScannerMode] = useState<ScannerMode>("camera");
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraEngine, setCameraEngine] = useState<"idle" | "native" | "zxing">(
    "idle"
  );
  const [manualCode, setManualCode] = useState("");
  const [hardwareCode, setHardwareCode] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

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
  }, [open, scannerMode]);

  useEffect(() => {
    if (!open || scannerMode !== "hardware") return;

    function handleGlobalScannerInput(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "Enter") {
        const cleaned = cleanBarcode(hardwareBufferRef.current);
        hardwareBufferRef.current = "";
        setHardwareCode("");

        if (cleaned) {
          handleDetectedOnce(cleaned);
        }

        return;
      }

      if (event.key.length !== 1) return;

      hardwareBufferRef.current += event.key;
      setHardwareCode(hardwareBufferRef.current);

      if (hardwareTimerRef.current !== null) {
        window.clearTimeout(hardwareTimerRef.current);
      }

      hardwareTimerRef.current = window.setTimeout(() => {
        const cleaned = cleanBarcode(hardwareBufferRef.current);
        hardwareBufferRef.current = "";
        setHardwareCode("");

        if (cleaned.length >= 4) {
          handleDetectedOnce(cleaned);
        }
      }, 180);
    }

    window.addEventListener("keydown", handleGlobalScannerInput);

    return () => {
      window.removeEventListener("keydown", handleGlobalScannerInput);

      if (hardwareTimerRef.current !== null) {
        window.clearTimeout(hardwareTimerRef.current);
        hardwareTimerRef.current = null;
      }
    };
  }, [open, scannerMode]);

  function cleanupCameraOnly() {
    if (detectorIntervalRef.current !== null) {
      window.clearInterval(detectorIntervalRef.current);
      detectorIntervalRef.current = null;
    }

    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // ignore scanner stop errors
      }

      zxingControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore pause errors
      }

      videoRef.current.srcObject = null;
    }

    if (mountedRef.current) {
      setCameraEngine("idle");
      setStarting(false);
    }
  }

  function cleanup() {
    cleanupCameraOnly();

    if (hardwareTimerRef.current !== null) {
      window.clearTimeout(hardwareTimerRef.current);
      hardwareTimerRef.current = null;
    }

    hardwareBufferRef.current = "";
  }

  function closeModal() {
    cleanup();
    onClose();
  }

  function handleDetectedOnce(value: string) {
    const cleaned = cleanBarcode(value);
    if (!cleaned || hasScannedRef.current) return;

    hasScannedRef.current = true;
    cleanup();
    onDetected(cleaned);
    onClose();
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    streamRef.current = stream;

    if (!videoRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      throw new Error("Camera preview failed to initialize.");
    }

    videoRef.current.srcObject = stream;
    await videoRef.current.play();
  }

  async function startNativeDetector(): Promise<boolean> {
    if (!window.BarcodeDetector || !videoRef.current) return false;

    try {
      const detector = new window.BarcodeDetector({
        formats: NATIVE_FORMATS,
      });

      if (!mountedRef.current) return false;

      setCameraEngine("native");

      detectorIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || hasScannedRef.current) return;
        if (videoRef.current.readyState < 2) return;

        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes?.[0]?.rawValue?.trim();

          if (raw) {
            handleDetectedOnce(raw);
          }
        } catch {
          // native detector can throw while video frame is changing
        }
      }, 250);

      return true;
    } catch {
      return false;
    }
  }

  async function startZxingFallback(): Promise<boolean> {
    if (!videoRef.current) return false;

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);

      if (!mountedRef.current) return false;

      setCameraEngine("zxing");

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result && !hasScannedRef.current) {
            const text = result.getText()?.trim();

            if (text) {
              handleDetectedOnce(text);
            }
          }
        }
      );

      if (!videoRef.current || !mountedRef.current) {
        try {
          controls.stop();
        } catch {
          // ignore stop errors
        }

        return false;
      }

      zxingControlsRef.current = controls;
      return true;
    } catch {
      return false;
    }
  }

  async function startScanner() {
    setStarting(true);
    setCameraError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this device/browser.");
      }

      await startCamera();

      const nativeStarted = await startNativeDetector();

      if (nativeStarted) {
        if (mountedRef.current) setStarting(false);
        return;
      }

      const zxingStarted = await startZxingFallback();

      if (zxingStarted) {
        if (mountedRef.current) setStarting(false);
        return;
      }

      throw new Error("Scanner failed to initialize.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Camera access failed.";

      if (mountedRef.current) {
        setCameraError(message);
        setStarting(false);
      }

      toast.error(message);
    }
  }

  function handleManualSubmit() {
    const cleaned = cleanBarcode(manualCode);
    if (!cleaned) return;

    handleDetectedOnce(cleaned);
  }

  function handleHardwareSubmit() {
    const cleaned = cleanBarcode(hardwareCode);
    if (!cleaned) return;

    handleDetectedOnce(cleaned);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <ScanLine className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-sm text-neutral-400">
                Camera, phone camera, Bluetooth, USB, Wi-Fi, or network scanner
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl p-2 transition hover:bg-white/10"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-3">
          <div className="grid grid-cols-3 gap-2">
            <ModeButton
              active={scannerMode === "camera"}
              label="Camera"
              icon={<Camera className="h-4 w-4" />}
              onClick={() => setScannerMode("camera")}
            />

            <ModeButton
              active={scannerMode === "hardware"}
              label="Scanner"
              icon={<Wifi className="h-4 w-4" />}
              onClick={() => setScannerMode("hardware")}
            />

            <ModeButton
              active={scannerMode === "manual"}
              label="Manual"
              icon={<Keyboard className="h-4 w-4" />}
              onClick={() => setScannerMode("manual")}
            />
          </div>
        </div>

        <div className="p-5">
          {scannerMode === "camera" ? (
            <>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
                <video
                  ref={videoRef}
                  className="aspect-video w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-[80%] rounded-xl border-2 border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.25)]" />
                </div>
              </div>

              <div className="mt-4 text-sm text-neutral-300">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>
                    {starting
                      ? "Starting camera..."
                      : cameraEngine === "native"
                        ? "Native multi-format scanner active"
                        : cameraEngine === "zxing"
                          ? "ZXing all-format scanner active"
                          : "Waiting..."}
                  </span>
                </div>

                {cameraError ? (
                  <p className="mt-2 text-red-400">{cameraError}</p>
                ) : null}

                <p className="mt-2 text-xs text-neutral-500">
                  Works with phone cameras, laptop cameras, QR codes, UPC,
                  EAN, Code 39, Code 128, Data Matrix, PDF417, Aztec, ITF,
                  Codabar, and more when supported by the browser/ZXing.
                </p>
              </div>
            </>
          ) : null}

          {scannerMode === "hardware" ? (
            <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Wifi className="h-5 w-5 text-emerald-300" />
                <div>
                  <h3 className="font-semibold text-white">
                    External Scanner Mode
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Use USB, Bluetooth, Wi-Fi, or network scanners configured as
                    keyboard/HID input.
                  </p>
                </div>
              </div>

              <input
                ref={hardwareInputRef}
                type="text"
                value={hardwareCode}
                onChange={(event) => setHardwareCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleHardwareSubmit();
                  }
                }}
                placeholder="Scan here..."
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-white outline-none placeholder:text-neutral-500"
              />

              <button
                type="button"
                onClick={handleHardwareSubmit}
                className="mt-3 rounded-xl bg-white px-4 py-2 font-medium text-black transition hover:opacity-90"
              >
                Submit Scan
              </button>

              <p className="mt-4 text-xs text-neutral-500">
                Most third-party scanners act like a keyboard and send the
                barcode followed by Enter. Pair or connect the scanner to the
                device first, then keep this scanner mode open.
              </p>
            </div>
          ) : null}

          {scannerMode === "manual" ? (
            <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Keyboard className="h-5 w-5 text-cyan-300" />
                <div>
                  <h3 className="font-semibold text-white">Manual Entry</h3>
                  <p className="text-sm text-neutral-400">
                    Type or paste any barcode value.
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleManualSubmit();
                  }
                }}
                placeholder="Enter barcode manually..."
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-white outline-none placeholder:text-neutral-500"
              />

              <button
                type="button"
                onClick={handleManualSubmit}
                className="mt-3 rounded-xl bg-white px-4 py-2 font-medium text-black transition hover:opacity-90"
              >
                Submit
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-black/40 text-neutral-300 hover:bg-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}