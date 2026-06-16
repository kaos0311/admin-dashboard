import { PackageCheck } from "lucide-react";

import { glass, spacing, tiles, typography } from "@/theme";

import type { RentalRecord } from "../rentals-types";
import { formatCurrency } from "../utils/formatters";

type RentalEquipmentTilesProps = {
  records: RentalRecord[];
  selectedKey: string;
  onSelect: (summary: EquipmentSummary) => void;
};

export type EquipmentSummary = {
  key: string;
  name: string;
  hcpc: string;
  group: string;
  outCount: number;
  totalValueOut: number;
  patientCount: number;
  sampleSerials: string[];
};

function buildEquipmentSummaries(records: RentalRecord[]): EquipmentSummary[] {
  const summaries = new Map<string, EquipmentSummary & { patientIds: Set<string> }>();

  records.forEach((record) => {
    const name = record.productName || record.itemId || "Unnamed equipment";
    const key = [name, record.procCode, record.itemGroup]
      .filter(Boolean)
      .join("|")
      .toLowerCase();
    const current =
      summaries.get(key) ??
      {
        key,
        name,
        hcpc: record.procCode || record.itemId,
        group: record.itemGroup,
        outCount: 0,
        totalValueOut: 0,
        patientCount: 0,
        patientIds: new Set<string>(),
        sampleSerials: [],
      };

    if (record.status === "checked_out" || record.status === "overdue") {
      current.outCount += Number(record.quantity) || 1;
      current.totalValueOut += record.monthlyRate || record.extAllow || record.allow || 0;
    }

    if (record.patientId || record.patientName) {
      current.patientIds.add(record.patientId || record.patientName);
      current.patientCount = current.patientIds.size;
    }

    const serial = record.serialNumber || record.assetTag;
    if (serial && current.sampleSerials.length < 3 && !current.sampleSerials.includes(serial)) {
      current.sampleSerials.push(serial);
    }

    summaries.set(key, current);
  });

  return Array.from(summaries.values())
    .map(({ patientIds: _patientIds, ...summary }) => summary)
    .sort((a, b) => b.totalValueOut - a.totalValueOut || b.outCount - a.outCount);
}

export function RentalEquipmentTiles({
  records,
  selectedKey,
  onSelect,
}: RentalEquipmentTilesProps) {
  const summaries = buildEquipmentSummaries(records);

  if (!summaries.length) return null;

  return (
    <section className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className={typography.caption}>Equipment Summary</p>
          <h2 className={typography.sectionTitle}>Rental Equipment Out</h2>
        </div>

        <p className={`${typography.bodyMuted} max-w-xl`}>
          Grouped by equipment name, showing how many are out and the total
          allowable value currently assigned.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary) => (
          <button
            type="button"
            key={summary.key}
            onClick={() => onSelect(summary)}
            className={[
              glass.cardPadded,
              glass.cardHover,
              "min-h-[210px] text-left",
              selectedKey === summary.key ? "ring-2 ring-cyan-300/45" : "",
            ].join(" ")}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={spacing.inline}>
                  <PackageCheck
                    className={`h-4 w-4 shrink-0 ${typography.caption}`}
                    aria-hidden="true"
                  />
                  <p className={typography.caption}>Asset</p>
                </div>

                <h3 className={`${typography.cardTitle} mt-3 break-words uppercase`}>
                  {summary.name}
                </h3>

                <p className={`${typography.smallMuted} mt-2 break-words`}>
                  {summary.hcpc || "No HCPCS"} · {summary.group || "No group"}
                </p>
              </div>

              <span className={tiles.badge}>Out</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Out" value={summary.outCount.toLocaleString()} />
              <Metric label="Value" value={formatCurrency(summary.totalValueOut)} />
            </div>

            <div className="mt-4 flex min-w-0 flex-wrap gap-2">
              <span className={tiles.tagMuted}>
                {summary.patientCount.toLocaleString()} patient
                {summary.patientCount === 1 ? "" : "s"}
              </span>

              {summary.sampleSerials.map((serial) => (
                <span key={serial} className={tiles.tagMuted}>
                  SN {serial}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={glass.insetPadded}>
      <p className={typography.caption}>{label}</p>
      <p className={`${typography.metricSmall} mt-1 break-words`}>{value}</p>
    </div>
  );
}
