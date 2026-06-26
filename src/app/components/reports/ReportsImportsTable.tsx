"use client";

import { badges, glass, tables, typography } from "@/theme";

type ImportMeta = {
  id: string;
  fileName: string;
  reportType?: string;
  importedAtLabel: string;
  totalRows: number;

  hospiceRows?: number;
  livingHospiceRows?: number;
  deceasedHospiceRows?: number;
  skippedHospiceRows?: number;
};

type Props = {
  imports: ImportMeta[];
};

function safeString(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

const countFormatter = new Intl.NumberFormat("en-US");

function CountBadge({
  value,
  color = "neutral",
}: {
  value: number;
  color?: "neutral" | "cyan" | "red" | "emerald";
}) {
  const classes: Record<string, string> = {
    neutral: badges.neutral,
    cyan: badges.info,
    red: badges.danger,
    emerald: badges.success,
  };

  if (value <= 0) {
    return <span className={typography.smallMuted}>0</span>;
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${classes[color]}`}
    >
      {countFormatter.format(value)}
    </span>
  );
}

export default function ReportsImportsTable({ imports }: Props) {
  return (
    <section className={glass.card}>
      <div
        className={`${glass.divider} flex flex-wrap items-center justify-between gap-4 px-6 py-5`}
      >
        <div>
          <h2 className={typography.sectionTitle}>Recent Imports</h2>

          <p className={`mt-1 ${typography.bodyMuted}`}>
            Imported report history and hospice filtering metrics.
          </p>
        </div>

        <div className={`${glass.inset} px-4 py-3 text-right`}>
          <div className={typography.caption}>Total Imports</div>

          <div className={typography.metricCompact}>
            {countFormatter.format(imports.length)}
          </div>
        </div>
      </div>

      <div className="admin-scroll overflow-x-auto">
        <table className="admin-table min-w-full">
          <thead className={glass.tableHeader}>
            <tr>
              <th className="px-4 py-4">File</th>
              <th className="px-4 py-4">Report Type</th>
              <th className="px-4 py-4">Imported</th>
              <th className="px-4 py-4 text-right">Total Rows</th>
              <th className="px-4 py-4 text-right">Hospice</th>
              <th className="px-4 py-4 text-right">Living</th>
              <th className="px-4 py-4 text-right">Deceased</th>
              <th className="px-4 py-4 text-right">Skipped</th>
            </tr>
          </thead>

          <tbody>
            {imports.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className={typography.subTitle}>No imports yet</div>

                    <div className={`mt-2 ${typography.bodyMuted}`}>
                      Uploaded reports will appear here once processing
                      completes.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              imports.map((item) => {
                const fileName = safeString(item.fileName, "Unnamed file");
                const reportType = safeString(item.reportType, "-");
                const importedAt = safeString(item.importedAtLabel, "-");
                const totalRows = safeNumber(item.totalRows);
                const hospiceRows = safeNumber(item.hospiceRows);
                const livingHospiceRows = safeNumber(item.livingHospiceRows);
                const deceasedHospiceRows = safeNumber(item.deceasedHospiceRows);
                const skippedHospiceRows = safeNumber(item.skippedHospiceRows);

                return (
                  <tr key={item.id} className={tables.row}>
                    <td className="px-4 py-4">
                      <div
                        className={`${typography.cardTitle} max-w-[320px] truncate`}
                      >
                        {fileName}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs ${badges.neutral}`}
                      >
                        {reportType}
                      </span>
                    </td>

                    <td className={`px-4 py-4 ${typography.bodyMuted}`}>
                      {importedAt}
                    </td>

                    <td
                      className={`${typography.mono} px-4 py-4 text-right`}
                    >
                      {countFormatter.format(totalRows)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge value={hospiceRows} color="cyan" />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge value={livingHospiceRows} color="emerald" />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge value={deceasedHospiceRows} color="red" />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge value={skippedHospiceRows} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

