"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalHeaderProps = {
  title: string;
  titleId: string;
  description?: string;
  icon?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
};

export function ModalHeader({
  title,
  titleId,
  description,
  icon,
  onClose,
  closeLabel = "Close modal",
}: ModalHeaderProps) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon ? <div>{icon}</div> : null}

        <div>
          <h2 id={titleId} className="text-2xl font-bold tracking-tight">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-sm leading-6 text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}