"use client";

import { colors, glass } from "@/theme";

export function WipLoadingState() {
  return (
    <main className={`min-h-screen px-4 py-6 md:px-6 xl:px-8 ${colors.adminShell}`}>
      <div className="mx-auto max-w-7xl space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={`${glass.card} h-28 animate-pulse`} />
        ))}
      </div>
    </main>
  );
}
