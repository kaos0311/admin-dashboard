"use client";

type EmptyStateProps = {
  text: string;
};

export function EmptyState({ text }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
      {text}
    </div>
  );
}