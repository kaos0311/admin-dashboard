"use client";

import {
  FileSearch,
  Loader2,
  Sparkles,
} from "lucide-react";

import { badges, buttons, glass, typography } from "@/theme";

type Props = {
  loading: boolean;
  answer: string;
  error: string;
  onScan: () => void;
};

export default function JarvisScanPanel({
  loading,
  answer,
  error,
  onScan,
}: Props) {
  return (
    <section className={`${glass.panel} p-5 sm:p-6`}>
      <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className={badges.info}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Jarvis Insurance Intelligence
          </div>

          <h2 className={`${typography.sectionTitle} mt-4`}>
            Insurance Change Scan
          </h2>

          <p className={`mt-2 max-w-4xl ${typography.bodyMuted}`}>
            Ask Jarvis to search reliable internet sources for payer updates,
            insurance changes, authorization requirements, documentation
            requirements, and billing requirements for DME/HME workflows.
          </p>
        </div>

        <button
          type="button"
          className={buttons.primary}
          onClick={onScan}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileSearch className="h-4 w-4" aria-hidden="true" />
          )}
          Scan Insurance Updates
        </button>
      </div>

      {error ? (
        <div className={`${glass.alertWarning} mt-5`}>{error}</div>
      ) : null}

      {answer ? (
        <div className={`${glass.insetPadded} mt-5`}>
          <h3 className={typography.subTitle}>Jarvis Scan Results</h3>
          <pre
            className={`mt-3 whitespace-pre-wrap break-words font-sans ${typography.bodyMuted}`}
          >
            {answer}
          </pre>
        </div>
      ) : (
        <div className={`${glass.insetPadded} mt-5 ${typography.bodyMuted}`}>
          Results will appear here with source links and human verification
          steps after Jarvis completes the scan.
        </div>
      )}
    </section>
  );
}
