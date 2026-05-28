"use client";

import type { RefObject } from "react";
import { Camera } from "lucide-react";
import type { CameraEngine } from "../types";

type CameraScannerPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  starting: boolean;
  cameraEngine: CameraEngine;
  cameraError: string;
};

export default function CameraScannerPanel({
  videoRef,
  starting,
  cameraEngine,
  cameraError,
}: CameraScannerPanelProps) {
  const statusText = starting
    ? "Starting camera..."
    : cameraEngine === "native"
      ? "Native multi-format scanner active"
      : cameraEngine === "zxing"
        ? "ZXing fallback scanner active"
        : "Waiting for camera...";

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/50">
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_35%,_rgba(0,0,0,0.55)_100%)]" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-44 w-[80%] rounded-2xl border-2 border-emerald-300/80 shadow-[0_0_45px_rgba(52,211,153,0.28)]" />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-emerald-200" />
          <span>{statusText}</span>
        </div>

        {cameraError ? (
          <p className="mt-2 text-sm font-medium text-red-300">
            {cameraError}
          </p>
        ) : null}

        <p className="mt-2 text-xs leading-5 text-zinc-500">
          Supports QR, UPC, EAN, Code 39, Code 128, Data Matrix, PDF417,
          Aztec, ITF, Codabar, and other formats supported by the browser or
          ZXing.
        </p>
      </div>
    </section>
  );
}
