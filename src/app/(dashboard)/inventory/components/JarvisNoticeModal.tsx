"use client";

import { SearchX, X } from "lucide-react";

import { buttons, glass, tiles, typography } from "@/theme";

type JarvisNoticeModalProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function JarvisNoticeModal({
  open,
  title,
  message,
  onClose,
}: JarvisNoticeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jarvis-notice-title"
    >
      <section className={`${glass.panel} w-full max-w-md p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className={tiles.icon}>
              <SearchX className="h-6 w-6 text-amber-200" />
            </span>

            <div className="min-w-0">
              <h2 id="jarvis-notice-title" className={typography.sectionTitle}>
                {title}
              </h2>
              <p className={`${typography.bodyMuted} mt-2`}>
                {message}
              </p>
            </div>
          </div>

          <button
            type="button"
            className={buttons.icon}
            onClick={onClose}
            aria-label="Close Jarvis notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className={`${buttons.secondary} mt-5 w-full`}
          onClick={onClose}
        >
          OK
        </button>
      </section>
    </div>
  );
}
