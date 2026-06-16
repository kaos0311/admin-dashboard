"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { buttons, colors, typography } from "@/theme";

type SignaturePadProps = {
  onChange: (dataUrl: string) => void;
};

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(ratio, ratio);
    ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "rgb(224, 242, 254)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const next = point(event);
    ctx.beginPath();
    ctx.moveTo(next.x, next.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const next = point(event);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    setHasInk(true);
  }

  function finish() {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;

    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="min-w-0">
      <div
        className={[
          "overflow-hidden rounded-2xl border",
          colors.border,
          "bg-slate-950/80",
        ].join(" ")}
      >
        <canvas
          ref={canvasRef}
          className="block h-44 w-full touch-none"
          aria-label="Electronic signature pad"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
        <p className={typography.smallMuted}>
          {hasInk ? "Signature captured." : "Patient, PAO, or next of kin signs here."}
        </p>

        <button type="button" onClick={clear} className={buttons.compactSecondary}>
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
