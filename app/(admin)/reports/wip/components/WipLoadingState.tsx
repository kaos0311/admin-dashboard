"use client";

export function WipLoadingState() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.055]"
          />
        ))}
      </div>
    </main>
  );
}


