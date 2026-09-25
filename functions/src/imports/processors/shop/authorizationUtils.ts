import type { ImportRow } from "../../types/stagingChunk";
import { read } from "./shopRowUtils";

export function rowHasActionableWip(row: ImportRow): boolean {
  return Boolean(
    read(row, [
      "WIPStatusName",
      "WIPDaysInState",
      "WIPAssignedTo",
      "WIPDateNeeded",
    ])
  );
}

const SYSTEM_WIP_ASSIGNEES = new Set([
  "administrator",
  "kayla black",
  "zach doss",
  "frank e field",
  "loraine good",
  "kelly griffey",
  "pamela ladd",
  "oliver steddum",
  "jennifer sullivan",
  "joe wilson",
  "nancy zordel",
  "nancey zordel",
]);

function normalizeAssigneeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCommaAssigneeLookupKey(value: string): string {
  const [last, rest] = value.split(",").map((part) => part?.trim()).filter(Boolean);

  if (!last || !rest) {
    return normalizeAssigneeLookupKey(value);
  }

  return normalizeAssigneeLookupKey(`${rest} ${last}`);
}

export function normalizeWipAssignee(value: string): string {
  const assignee = value.trim() || "Unassigned";
  const key = normalizeAssigneeLookupKey(assignee);
  const commaKey = normalizeCommaAssigneeLookupKey(assignee);

  return SYSTEM_WIP_ASSIGNEES.has(key) || SYSTEM_WIP_ASSIGNEES.has(commaKey)
    ? "System"
    : assignee;
}

export function mapWipStatus(value: string, completed = false): "open" | "pending" | "completed" | "cancelled" {
  if (completed) return "completed";

  const text = value.trim().toLowerCase();
  if (text.includes("complete") || text.includes("done")) return "completed";
  if (text.includes("resolved")) return "completed";
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("pending") || text.includes("hold")) return "pending";
  return "open";
}
