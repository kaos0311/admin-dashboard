"use client";

import { AlertTriangle } from "lucide-react";

type WipErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function WipErrorState({ message, onRetry }: WipErrorStateProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-300/20 bg-red-400/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <div className="mb-4 inline-flex rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-red-200">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <h1 className="text-xl font-bold text-white">WIP failed to load</h1>

        <p className="mt-2 text-sm text-slate-300">{message}</p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
