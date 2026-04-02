"use client";

import { useEffect, useRef, useCallback } from "react";
import SignaturePadLib from "signature_pad";

type SignaturePadProps = {
  onEnd?: (dataUrl: string) => void;
  disabled?: boolean;
  className?: string;
};

export function SignaturePad({ onEnd, disabled, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  // Resize canvas to match display size (retina-aware)
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    // Clear after resize — old content is lost anyway
    padRef.current?.clear();
    onEnd?.(""); // notify parent so stale data doesn't allow submit
  }, [onEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
    });
    padRef.current = pad;

    if (disabled) pad.off();

    pad.addEventListener("endStroke", () => {
      onEnd?.(pad.toDataURL("image/png"));
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      pad.off();
    };
  }, [disabled, onEnd, resizeCanvas]);

  function handleClear() {
    padRef.current?.clear();
    onEnd?.("");
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border-2 border-zinc-300 touch-none"
        style={{ height: 160 }}
      />
      {!disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-2 text-sm text-zinc-500 underline"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}
