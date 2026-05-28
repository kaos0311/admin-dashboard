import { Clock3 } from "lucide-react";
import { glassPanelSoft } from "../../styles/glass";

export function RecentActivityCard() {
  return (
    <aside className={`${glassPanelSoft} p-4`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
          <Clock3 className="h-5 w-5 text-cyan-200" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
          <p className="text-xs text-slate-500">Settings audit placeholder</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
        <p className="text-sm leading-6 text-slate-400">
          Activity logging should be wired to <span className="text-slate-200">auditLogs</span>{" "}
          when settings updates are finalized through admin-only operations.
        </p>
      </div>
    </aside>
  );
}
