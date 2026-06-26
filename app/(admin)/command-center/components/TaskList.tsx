import Link from "next/link";

import { glass, typography } from "@/theme";

import type { CommandTask } from "../types";

import { alertButtonClass } from "../utils/commandCenterFormat";

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
          id={`task-${task.id}`}
          className={`${glass.card} p-4`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={typography.cardTitle}>
                {task.title || "Untitled Task"}
              </h3>

              <p className="mt-1 text-sm text-neutral-400">
                {task.assignedTo || "Unassigned"}
                {task.department ? ` - ${task.department}` : ""}
              </p>
            </div>

            <Link
              href={`/command-center?task=${encodeURIComponent(task.id)}#task-${task.id}`}
              className={alertButtonClass(task.priority)}
              aria-label={`Open ${task.priority || "normal"} task ${task.title || task.id}`}
            >
              {task.priority || "normal"}
            </Link>
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
