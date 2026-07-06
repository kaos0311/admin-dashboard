import { tiles } from "@/theme";

export function AnalyticsLoadingBar() {
  return (
    <div
      role="status"
      aria-label="Loading analytics data"
      aria-live="polite"
      className={[
        tiles.base,
        "h-12 min-w-0 animate-pulse overflow-hidden",
      ].join(" ")}
    >
      <span className="sr-only">Loading analytics data...</span>
    </div>
  );
}



