import { FileText } from "lucide-react";

import { badges, colors, glass, typography } from "@/theme";

export function PatientReportSources({
  reportTypes,
}: {
  reportTypes?: string[];
}) {
  return (
    <section className={glass.cardPadded}>
      <div className="mb-4 flex items-center gap-2">
        <FileText className={`h-5 w-5 ${colors.textSecondary}`} />
        <h2 className={typography.cardTitle}>Report Sources</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {reportTypes?.length ? (
          reportTypes.map((type) => (
            <span
              key={type}
              className={`rounded-full px-3 py-1 text-xs ${badges.neutral}`}
            >
              {type}
            </span>
          ))
        ) : (
          <span className={typography.bodyFaint}>No report sources listed.</span>
        )}
      </div>
    </section>
  );
}
