"use client";

import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Plus,
} from "lucide-react";

import { glass, spacing, typography } from "@/theme";

import type { PatientTaskPriority } from "../../lib/patientTypes";
import { formatDate } from "../../lib/patientUtils";
import {
  ActionButton,
  EmptyState,
  Input,
  Section,
  TaskPriorityPill,
} from "../PatientUI";
import type { PatientDetailProps } from "./patient-detail-types";

type TaskPriorityOption = {
  label: string;
  value: PatientTaskPriority;
};

const TASK_PRIORITY_OPTIONS: TaskPriorityOption[] = [
  {
    label: "Routine",
    value: "routine",
  },
  {
    label: "Watch",
    value: "watch",
  },
  {
    label: "Urgent",
    value: "urgent",
  },
];

const FULL_WIDTH_SECTION = "md:col-span-3";
const TASK_FORM_GRID = "grid gap-3 md:grid-cols-4";
const TASK_ROW_LAYOUT =
  "flex flex-col gap-3 md:flex-row md:items-center md:justify-between";
const FULL_WIDTH_ACTION = "md:col-span-4";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PatientTasksSection({
  selected,
  savingTask,
  newTaskTitle,
  newTaskAssignedTo,
  newTaskDueDate,
  newTaskPriority,
  setNewTaskTitle,
  setNewTaskAssignedTo,
  setNewTaskDueDate,
  setNewTaskPriority,
  addTask,
  updateTaskStatus,
}: Pick<
  PatientDetailProps,
  | "selected"
  | "savingTask"
  | "newTaskTitle"
  | "newTaskAssignedTo"
  | "newTaskDueDate"
  | "newTaskPriority"
  | "setNewTaskTitle"
  | "setNewTaskAssignedTo"
  | "setNewTaskDueDate"
  | "setNewTaskPriority"
  | "addTask"
  | "updateTaskStatus"
>) {
  const openTasks =
    selected.tasks?.filter((task) => task.status === "open") ?? [];

  return (
    <Section
      title="Care Coordination Tasks"
      icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
    >
      <div className={cx(spacing.stackTight, FULL_WIDTH_SECTION)}>
        <div className={cx(glass.cardPadded, TASK_FORM_GRID)}>
          <Input
            label="Task Title"
            value={newTaskTitle}
            onChange={setNewTaskTitle}
            placeholder="Example: Follow up on PAR renewal"
          />

          <Input
            label="Assigned To"
            value={newTaskAssignedTo}
            onChange={setNewTaskAssignedTo}
            placeholder="Staff member"
          />

          <Input
            label="Due Date"
            type="date"
            value={newTaskDueDate}
            onChange={setNewTaskDueDate}
          />

          <label htmlFor="task-priority">
            <span className={cx("mb-2 block", typography.formLabel)}>
              Priority
            </span>

            <select
              id="task-priority"
              name="task-priority"
              value={newTaskPriority}
              onChange={(event) =>
                setNewTaskPriority(event.target.value as PatientTaskPriority)
              }
              className={glass.select}
            >
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className={FULL_WIDTH_ACTION}>
            <ActionButton
              tone="green"
              disabled={savingTask}
              onClick={() => void addTask(selected)}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              label={savingTask ? "Saving Task..." : "Add Task"}
            />
          </div>
        </div>

        {openTasks.length > 0 ? (
          <div className={spacing.stackTight}>
            {openTasks.map((task) => (
              <article
                key={task.id}
                className={cx(glass.cardPadded, TASK_ROW_LAYOUT)}
              >
                <div className={spacing.stackTight}>
                  <div className={spacing.actions}>
                    <p className={typography.bodyStrong}>{task.title}</p>
                    <TaskPriorityPill priority={task.priority} />
                  </div>

                  <p className={typography.small}>
                    Assigned: {task.assignedTo || "—"} | Due:{" "}
                    {formatDate(task.dueDate)}
                  </p>
                </div>

                <ActionButton
                  tone="green"
                  disabled={savingTask}
                  onClick={() =>
                    void updateTaskStatus(selected, task.id, "done")
                  }
                  icon={
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  }
                  label="Mark Done"
                />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
            title="No open tasks"
            message="No open care coordination tasks are indexed for this patient."
          />
        )}
      </div>
    </Section>
  );
}

