"use client";

import { useCallback, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import toast from "react-hot-toast";

import type { CameraEngine } from "../types";
import { NATIVE_FORMATS, ZXING_FORMATS } from "../utils/scanner-formats";

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

type UseBarcodeScannerParams = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mountedRef: React.RefObject<boolean>;
  hasScannedRef: React.RefObject<boolean>;
  onDetected: (code: string) => void;
};

export function useBarcodeScanner({
  videoRef,
  mountedRef,
  hasScannedRef,
  onDetected,
}: UseBarcodeScannerParams) {
  const streamRef = useRef<MediaStream | null>(null);
  const detectorIntervalRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);

  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraEngine, setCameraEngine] = useState<CameraEngine>("idle");

  const cleanupCameraOnly = useCallback(() => {
    if (detectorIntervalRef.current !== null) {
      window.clearInterval(detectorIntervalRef.current);
      detectorIntervalRef.current = null;
    }

    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // scanner cleanup should never crash the UI
      }

      zxingControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore device cleanup errors
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
  }, [mountedRef, videoRef]);

  const startCamera = useCallback(async () => {
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
  }, [videoRef]);

  const startNativeDetector = useCallback(async (): Promise<boolean> => {
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

          if (raw) onDetected(raw);
        } catch {
          // native detector can throw while frames change
        }
      }, 250);

      return true;
    } catch {
      return false;
    }
  }, [hasScannedRef, mountedRef, onDetected, videoRef]);

  const startZxingFallback = useCallback(async (): Promise<boolean> => {
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
          if (!result || hasScannedRef.current) return;

          const text = result.getText()?.trim();
          if (text) onDetected(text);
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
  }, [hasScannedRef, mountedRef, onDetected, videoRef]);

  const startScanner = useCallback(async () => {
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
  }, [mountedRef, startCamera, startNativeDetector, startZxingFallback]);

  return {
    starting,
    cameraError,
    cameraEngine,
    setCameraError,
    startScanner,
    cleanupCameraOnly,
  };
}
