import { AlertTriangle, RotateCcw } from "lucide-react";
import { dangerButton } from "../../styles/glass";
import { InfoCard } from "../shared/InfoCard";

export function ResetCard() {
  function handleClick() {
    window.alert(
      "Wire this to an admin-only Cloud Function before enabling it. Client-side destructive operations are how systems become crime scenes."
    );
  }

  return (
    <InfoCard
      title="Reset Imported Reports"
      description="This should call your admin-only report reset function after confirmation text and audit logging are wired."
    >
      <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />

          <div>
            <p className="text-sm font-semibold text-red-50">
              Destructive operation
            </p>
            <p className="mt-1 text-sm leading-6 text-red-100/80">
              Do not enable direct reset logic from the browser. Route it through
              Cloud Functions, require admin claims, and write audit logs.
            </p>
          </div>
        </div>

        <button type="button" onClick={handleClick} className={`${dangerButton} mt-4`}>
          <RotateCcw className="h-4 w-4" />
          Reset Reports
        </button>
      </div>
    </InfoCard>
  );
}