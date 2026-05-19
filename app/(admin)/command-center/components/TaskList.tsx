import type { CommandTask } from "../types";
import { badgeClass } from "../utils/commandCenterFormat";
import { EmptyState } from "./EmptyState";

type TaskListProps = {
  tasks: CommandTask[];
};

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState text="No open tasks found. Suspiciously peaceful, which usually means nobody entered the work yet." />
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                {task.title || "Untitled Task"}
              </h3>

              <p className="mt-1 text-sm text-neutral-400">
                {task.assignedTo || "Unassigned"}
                {task.department ? ` • ${task.department}` : ""}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                task.priority
              )}`}
            >
              {task.priority || "normal"}
            </span>
          </div>

          {task.description ? (
            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {task.description}
            </p>
          ) : null}

          {(task.escalationLevel ?? 0) > 0 ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-300">
              Escalation Level {task.escalationLevel}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}