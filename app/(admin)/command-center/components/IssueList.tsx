import type { ComplianceIssue } from "../types";
import { badgeClass, formatIssueType } from "../utils/commandCenterFormat";
import { EmptyState } from "./EmptyState";

type IssueListProps = {
  issues: ComplianceIssue[];
};

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <EmptyState text="No open compliance issues found. Either things are clean, or the engine has not started doing its job yet." />
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                {formatIssueType(issue.issueType)}
              </h3>

              <p className="mt-1 text-sm text-neutral-400">
                {issue.patientName || "Unknown patient"}
                {issue.dob ? ` • DOB: ${issue.dob}` : ""}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                issue.severity
              )}`}
            >
              {issue.severity || "unknown"}
            </span>
          </div>

          {issue.notes ? (
            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {issue.notes}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}