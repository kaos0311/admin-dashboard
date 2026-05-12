"use client";

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
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
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
    neutral:
      "border-white/10 bg-white/5 text-neutral-300",
    cyan:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    red:
      "border-red-500/20 bg-red-500/10 text-red-300",
    emerald:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  };

  if (value <= 0) {
    return <span className="text-neutral-500">0</span>;
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${classes[color]}`}
    >
      {countFormatter.format(value)}
    </span>
  );
}

export default function ReportsImportsTable({
  imports,
}: Props) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Recent Imports
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Imported report history and hospice filtering metrics.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">
            Total Imports
          </div>

          <div className="mt-1 text-lg font-semibold text-white">
            {countFormatter.format(imports.length)}
          </div>
        </div>
      </div>

      <div className="admin-scroll overflow-x-auto">
        <table className="admin-table min-w-full">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950 text-neutral-400 backdrop-blur">
            <tr>
              <th className="px-4 py-4">File</th>

              <th className="px-4 py-4">
                Report Type
              </th>

              <th className="px-4 py-4">
                Imported
              </th>

              <th className="px-4 py-4 text-right">
                Total Rows
              </th>

              <th className="px-4 py-4 text-right">
                Hospice
              </th>

              <th className="px-4 py-4 text-right">
                Living
              </th>

              <th className="px-4 py-4 text-right">
                Deceased
              </th>

              <th className="px-4 py-4 text-right">
                Skipped
              </th>
            </tr>
          </thead>

          <tbody>
            {imports.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-14 text-center"
                >
                  <div className="mx-auto max-w-sm">
                    <div className="text-lg font-medium text-neutral-300">
                      No imports yet
                    </div>

                    <div className="mt-2 text-sm text-neutral-500">
                      Uploaded reports will appear here once
                      processing completes.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              imports.map((item) => {
                const fileName = safeString(
                  item.fileName,
                  "Unnamed file"
                );

                const reportType = safeString(
                  item.reportType,
                  "-"
                );

                const importedAt = safeString(
                  item.importedAtLabel,
                  "-"
                );

                const totalRows = safeNumber(
                  item.totalRows
                );

                const hospiceRows = safeNumber(
                  item.hospiceRows
                );

                const livingHospiceRows = safeNumber(
                  item.livingHospiceRows
                );

                const deceasedHospiceRows = safeNumber(
                  item.deceasedHospiceRows
                );

                const skippedHospiceRows = safeNumber(
                  item.skippedHospiceRows
                );

                return (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 transition hover:bg-white/[0.035]"
                  >
                    <td className="px-4 py-4">
                      <div className="max-w-[320px] truncate font-medium text-white">
                        {fileName}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                        {reportType}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-neutral-400">
                      {importedAt}
                    </td>

                    <td className="px-4 py-4 text-right font-mono text-white">
                      {countFormatter.format(totalRows)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge
                        value={hospiceRows}
                        color="cyan"
                      />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge
                        value={livingHospiceRows}
                        color="emerald"
                      />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge
                        value={deceasedHospiceRows}
                        color="red"
                      />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <CountBadge
                        value={skippedHospiceRows}
                        color="neutral"
                      />
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