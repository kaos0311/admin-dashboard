"use client";

import { AlertTriangle } from "lucide-react";

import { buttons, glass, typography } from "@/theme";

type WipErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function WipErrorState({ message, onRetry }: WipErrorStateProps) {
  return (
    <main className={`${glass.page} px-4 py-6 md:px-6 xl:px-8`}>
      <div className={`${glass.alertDanger} mx-auto max-w-3xl p-6`}>
        <div className="mb-4 inline-flex rounded-2xl p-3">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <h1 className={typography.sectionTitle}>WIP failed to load</h1>

        <p className={`mt-2 ${typography.bodyMuted}`}>{message}</p>

        <button
          type="button"
          onClick={onRetry}
          className={`${buttons.secondary} mt-5`}
        >
          Try Again
        </button>
      </div>
    </main>
  );
}

