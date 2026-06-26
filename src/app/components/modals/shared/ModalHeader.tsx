"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { buttons, typography } from "@/theme";

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
          <h2 id={titleId} className={typography.sectionTitle}>
            {title}
          </h2>

          {description ? (
            <p className={`${typography.bodyMuted} mt-1`}>
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className={buttons.icon}
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}



