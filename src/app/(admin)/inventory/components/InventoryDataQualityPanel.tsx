"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";

import { buttons, glass, typography } from "@/theme";
import {
  type InventoryCleanupAction,
  type InventoryCleanupResult,
  inventoryCleanupWorkflow,
} from "@/lib/domainWorkflows";
import {
  analyzeInventoryGroupingRisks,
  INVENTORY_GROUPING_RISK_SEVERITIES,
  INVENTORY_GROUPING_RISK_TYPES,
  type InventoryGroupingRisk,
  type InventoryGroupingRiskSeverity,
  type InventoryGroupingRiskType,
} from "../lib/inventoryGroupingRisks";
import { normalizeSearchText } from "../lib/inventoryNormalize";
import type { InventoryItem } from "../lib/inventoryTypes";
import type { InventorySerializationFilter } from "../hooks/useInventoryFilters";
import { FilterSelect } from "./fields/FilterSelect";
import { SearchInput } from "./fields/SearchInput";

type InventoryDataQualityPanelProps = {
  items: InventoryItem[];
  canCleanup: boolean;
  onOpenItem: (item: InventoryItem) => void;
  onCleanupApplied: () => void;
};

type SeverityFilter = "all" | InventoryGroupingRiskSeverity;
type TypeFilter = "all" | InventoryGroupingRiskType;
type CleanupState = {
  risk: InventoryGroupingRisk;
  inventoryItemId: string;
  action: InventoryCleanupAction;
  newValue: string;
  targetProductId: string;
  reason: string;
  acknowledgement: string;
  operationId: string;
  preview: InventoryCleanupResult | null;
  busy: boolean;
};

export function InventoryDataQualityPanel({
  items,
  canCleanup,
  onOpenItem,
  onCleanupApplied,
}: InventoryDataQualityPanelProps) {
  const analysis = useMemo(
    () => analyzeInventoryGroupingRisks({ inventoryItems: items }),
    [items],
  );
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    () => new Set(),
  );
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [serializationFilter, setSerializationFilter] =
    useState<InventorySerializationFilter>("all");
  const [cleanupState, setCleanupState] = useState<CleanupState | null>(null);

  const categoryOptions = useMemo(
    () => unique(analysis.risks.map((risk) => risk.currentCategory)),
    [analysis.risks],
  );
  const productOptions = useMemo(
    () => unique(analysis.risks.map((risk) => risk.productName)),
    [analysis.risks],
  );
  const locationOptions = useMemo(
    () => unique(analysis.risks.map((risk) => risk.locationName)),
    [analysis.risks],
  );

  const filteredRisks = useMemo(() => {
    const term = normalizeSearchText(search);

    return analysis.risks.filter((risk) => {
      if (severityFilter !== "all" && risk.severity !== severityFilter) return false;
      if (typeFilter !== "all" && risk.type !== typeFilter) return false;
      if (categoryFilter !== "all" && risk.currentCategory !== categoryFilter) return false;
      if (productFilter !== "all" && risk.productName !== productFilter) return false;
      if (locationFilter !== "all" && risk.locationName !== locationFilter) return false;
      if (serializationFilter === "serialized" && !risk.isSerialized) return false;
      if (serializationFilter === "quantity" && risk.isSerialized) return false;
      if (!term) return true;

      return risk.searchText.includes(term);
    });
  }, [
    analysis.risks,
    categoryFilter,
    locationFilter,
    productFilter,
    search,
    serializationFilter,
    severityFilter,
    typeFilter,
  ]);

  const risksByType = useMemo(() => {
    const groups = new Map<InventoryGroupingRiskType, InventoryGroupingRisk[]>();
    filteredRisks.forEach((risk) => {
      groups.set(risk.type, [...(groups.get(risk.type) ?? []), risk]);
    });

    return Array.from(groups.entries()).sort(([leftType], [rightType]) =>
      leftType.localeCompare(rightType)
    );
  }, [filteredRisks]);

  function toggleType(type: string): void {
    setExpandedTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function openFirstRiskRecord(risk: InventoryGroupingRisk): void {
    const item = risk.inventoryItemIds
      .map((id) => itemById.get(id))
      .find((candidate): candidate is InventoryItem => Boolean(candidate));

    if (item) onOpenItem(item);
  }

  function handleExport(): void {
    exportRiskCsv(filteredRisks);
  }

  function openCleanup(risk: InventoryGroupingRisk): void {
    setCleanupState({
      risk,
      inventoryItemId: risk.inventoryItemIds[0] ?? "",
      action: defaultActionForRisk(risk.type),
      newValue: defaultNewValueForRisk(risk),
      targetProductId: "",
      reason: "",
      acknowledgement: "",
      operationId: createOperationId(),
      preview: null,
      busy: false,
    });
  }

  async function handlePreviewCleanup(): Promise<void> {
    if (!cleanupState) return;
    setCleanupState({ ...cleanupState, busy: true });
    try {
      const preview = await inventoryCleanupWorkflow({
        mode: "preview",
        operationId: cleanupState.operationId,
        action: cleanupState.action,
        inventoryItemId: cleanupState.inventoryItemId,
        targetProductId: cleanupState.targetProductId,
        newValue: cleanupState.newValue,
        reason: cleanupState.reason,
        riskId: cleanupState.risk.riskId,
      });
      setCleanupState({ ...cleanupState, preview, busy: false });
    } catch (error) {
      setCleanupState({ ...cleanupState, busy: false });
      toast.error(error instanceof Error ? error.message : "Cleanup preview failed.");
    }
  }

  async function handleApplyCleanup(): Promise<void> {
    if (!cleanupState?.preview) return;
    setCleanupState({ ...cleanupState, busy: true });
    try {
      const result = await inventoryCleanupWorkflow({
        mode: "apply",
        operationId: cleanupState.operationId,
        action: cleanupState.action,
        inventoryItemId: cleanupState.inventoryItemId,
        targetProductId: cleanupState.targetProductId,
        newValue: cleanupState.newValue,
        reason: cleanupState.reason,
        acknowledgement: cleanupState.acknowledgement,
        previewToken: cleanupState.preview.previewToken,
        riskId: cleanupState.risk.riskId,
      });
      toast.success(result.status === "duplicate_operation" ? "Cleanup already applied." : "Cleanup applied.");
      setCleanupState(null);
      onCleanupApplied();
    } catch (error) {
      setCleanupState({ ...cleanupState, busy: false });
      toast.error(error instanceof Error ? error.message : "Cleanup apply failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className={`${typography.sectionTitle} break-words`}>
            Inventory Data Quality
          </h3>
          <p className={`mt-2 ${typography.bodyMuted}`}>
            Read-only diagnostics for records that may be grouped incorrectly.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className={buttons.secondary}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Critical Issues" value={analysis.summary.critical} tone="critical" />
        <SummaryCard label="High Risk" value={analysis.summary.high} tone="high" />
        <SummaryCard label="Medium Risk" value={analysis.summary.medium} tone="medium" />
        <SummaryCard label="Uncategorized" value={analysis.summary.uncategorized} tone="medium" />
        <SummaryCard label="Duplicate Serials" value={analysis.summary.duplicateSerials} tone="critical" />
        <SummaryCard label="Weak Identity" value={analysis.summary.weakProductIdentity} tone="medium" />
      </div>

      <div className={`${glass.inset} rounded-lg p-4`}>
        <div className="mb-3 grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <SearchInput value={search} onChange={setSearch} />
          <FilterSelect
            label="Filter risk severity"
            value={severityFilter}
            onChange={(value) => setSeverityFilter(value as SeverityFilter)}
            options={[
              ["all", "All severities"],
              ...INVENTORY_GROUPING_RISK_SEVERITIES.map((severity) => [severity, severity] as [string, string]),
            ]}
          />
          <FilterSelect
            label="Filter risk type"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as TypeFilter)}
            options={[
              ["all", "All risk types"],
              ...INVENTORY_GROUPING_RISK_TYPES.map((type) => [type, formatRiskType(type)] as [string, string]),
            ]}
          />
          <FilterSelect
            label="Filter risk category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              ["all", "All categories"],
              ...categoryOptions.map((category) => [category, category] as [string, string]),
            ]}
          />
          <FilterSelect
            label="Filter risk product"
            value={productFilter}
            onChange={setProductFilter}
            options={[
              ["all", "All products"],
              ...productOptions.map((product) => [product, product] as [string, string]),
            ]}
          />
          <FilterSelect
            label="Filter risk location"
            value={locationFilter}
            onChange={setLocationFilter}
            options={[
              ["all", "All locations"],
              ...locationOptions.map((location) => [location, location] as [string, string]),
            ]}
          />
          <FilterSelect
            label="Filter risk inventory type"
            value={serializationFilter}
            onChange={(value) => setSerializationFilter(value as InventorySerializationFilter)}
            options={[
              ["all", "All inventory types"],
              ["serialized", "Serialized"],
              ["quantity", "Quantity"],
            ]}
          />
        </div>

        <p className={typography.smallMuted}>
          Showing {filteredRisks.length.toLocaleString()} of {analysis.summary.totalRisks.toLocaleString()} risks.
          Category metadata: {analysis.categoryQuality.explicit.toLocaleString()} explicit,
          {" "}{analysis.categoryQuality.inferred.toLocaleString()} inferred,
          {" "}{analysis.categoryQuality.fallback.toLocaleString()} fallback,
          {" "}{analysis.categoryQuality.dynamic.toLocaleString()} dynamic.
        </p>
      </div>

      {filteredRisks.length === 0 ? (
        <div className={`${glass.inset} rounded-lg px-4 py-8 text-center`}>
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-white/40" />
          <p className={typography.bodyStrong}>No grouping risks match these filters.</p>
          <p className={typography.smallMuted}>Adjust the diagnostics filters to broaden the report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {risksByType.map(([type, risks]) => {
            const expanded = expandedTypes.has(type);

            return (
              <section key={type} className={`${glass.inset} overflow-hidden rounded-lg`}>
                <button
                  type="button"
                  onClick={() => toggleType(type)}
                  className="flex w-full items-start justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10"
                  aria-expanded={expanded}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 rounded-md border border-white/10 bg-black/20 p-2">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h4 className={`${typography.bodyStrong} break-words`}>
                        {formatRiskType(type)}
                      </h4>
                      <p className={typography.smallMuted}>
                        {risks.length.toLocaleString()} matching risks
                      </p>
                    </div>
                  </div>
                  <SeverityBadge severity={highestSeverity(risks)} />
                </button>

                {expanded ? (
                  <div className="divide-y divide-white/10">
                    {risks.map((risk) => (
                      <RiskRow
                        key={risk.riskId}
                        risk={risk}
                        canCleanup={canCleanup}
                        onOpen={() => openFirstRiskRecord(risk)}
                        onCleanup={() => openCleanup(risk)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {cleanupState ? (
        <CleanupModal
          state={cleanupState}
          onChange={setCleanupState}
          onPreview={() => {
            void handlePreviewCleanup();
          }}
          onApply={() => {
            void handleApplyCleanup();
          }}
          onClose={() => setCleanupState(null)}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "high" | "medium";
}) {
  const toneClass = {
    critical: "border-red-400/30 bg-red-500/10 text-red-100",
    high: "border-orange-400/30 bg-orange-500/10 text-orange-100",
    medium: "border-yellow-400/30 bg-yellow-500/10 text-yellow-100",
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function RiskRow({
  risk,
  canCleanup,
  onOpen,
  onCleanup,
}: {
  risk: InventoryGroupingRisk;
  canCleanup: boolean;
  onOpen: () => void;
  onCleanup: () => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-start">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={risk.severity} />
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
            {risk.confidence} confidence
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
            {risk.isSerialized ? "Serialized" : "Quantity"}
          </span>
        </div>

        <p className={`${typography.bodyStrong} break-words`}>
          {risk.description}
        </p>
        <p className={typography.smallMuted}>
          {risk.productName} | {risk.manufacturer} {risk.modelNumber} | Product ID {risk.productId}
        </p>
        <p className={typography.smallMuted}>
          Category {risk.currentCategory} | Location {risk.locationName} | Group {risk.currentProductGroupingKey}
        </p>
        <p className={typography.smallMuted}>
          Records {risk.inventoryItemIds.join(", ")}
          {risk.identifiers.length > 0 ? ` | Identifiers ${risk.identifiers.join(", ")}` : ""}
        </p>
        <p className={typography.bodyMuted}>
          Recommended action: {risk.recommendedCleanupAction}
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onOpen} className={buttons.secondary}>
          Open record
        </button>
        {canCleanup && cleanupSupported(risk.type) ? (
          <button type="button" onClick={onCleanup} className={buttons.primary}>
            Cleanup
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CleanupModal({
  state,
  onChange,
  onPreview,
  onApply,
  onClose,
}: {
  state: CleanupState;
  onChange: (state: CleanupState) => void;
  onPreview: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const preview = state.preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`${glass.panel} max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={typography.sectionTitle}>Inventory Cleanup Preview</h3>
            <p className={typography.bodyMuted}>
              Manual, audited cleanup for {formatRiskType(state.risk.type)}.
            </p>
          </div>
          <button type="button" onClick={onClose} className={buttons.secondary}>
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className={typography.smallMuted}>Inventory record</span>
            <select
              value={state.inventoryItemId}
              onChange={(event) => onChange({ ...state, inventoryItemId: event.target.value, preview: null })}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              {state.risk.inventoryItemIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className={typography.smallMuted}>Action</span>
            <select
              value={state.action}
              onChange={(event) => onChange({ ...state, action: event.target.value as InventoryCleanupAction, preview: null })}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              {cleanupActionOptions(state.risk.type).map((action) => (
                <option key={action} value={action}>{formatRiskType(action)}</option>
              ))}
            </select>
          </label>

          {state.action === "LINK_CANONICAL_PRODUCT" || state.action === "RELINK_PRODUCT_ID" ? (
            <label className="space-y-1 md:col-span-2">
              <span className={typography.smallMuted}>Canonical product ID</span>
              <input
                value={state.targetProductId}
                onChange={(event) => onChange({ ...state, targetProductId: event.target.value, preview: null })}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
          ) : state.action !== "MARK_AS_REVIEWED" && state.action !== "DISMISS_FALSE_POSITIVE" ? (
            <label className="space-y-1 md:col-span-2">
              <span className={typography.smallMuted}>New value</span>
              <input
                value={state.newValue}
                onChange={(event) => onChange({ ...state, newValue: event.target.value, preview: null })}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
          ) : null}
        </div>

        {preview ? (
          <div className="mt-5 space-y-4">
            <div className={`${glass.inset} rounded-lg p-4`}>
              <h4 className={typography.bodyStrong}>Field changes</h4>
              {preview.diff.length === 0 ? (
                <p className={typography.smallMuted}>No inventory fields will change.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {preview.diff.map((change) => (
                    <div key={change.field} className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 md:grid-cols-[140px_1fr_1fr]">
                      <div className={typography.smallMuted}>{change.field}</div>
                      <div className="break-words text-red-100">{change.before || "-"}</div>
                      <div className="break-words text-green-100">{change.after || "-"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {preview.warnings.length > 0 ? (
              <div className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-4 text-yellow-100">
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <div className={`${glass.inset} rounded-lg p-4`}>
              <h4 className={typography.bodyStrong}>Side effects</h4>
              <ul className={`mt-2 space-y-1 ${typography.smallMuted}`}>
                {preview.sideEffects.map((sideEffect) => (
                  <li key={sideEffect}>{sideEffect}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <label className="mt-5 block space-y-1">
          <span className={typography.smallMuted}>
            Reason {preview?.requiresReason ? "(required)" : "(optional)"}
          </span>
          <textarea
            value={state.reason}
            onChange={(event) => onChange({ ...state, reason: event.target.value })}
            className="min-h-24 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>

        {preview?.requiresAcknowledgement ? (
          <label className="mt-4 block space-y-1">
            <span className={typography.smallMuted}>
              Type: I understand this changes serialized asset identity.
            </span>
            <input
              value={state.acknowledgement}
              onChange={(event) => onChange({ ...state, acknowledgement: event.target.value })}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </label>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onPreview} disabled={state.busy} className={buttons.secondary}>
            Preview
          </button>
          <button type="button" onClick={onApply} disabled={state.busy || !preview} className={buttons.primary}>
            Confirm Apply
          </button>
        </div>
      </div>
    </div>
  );
}


function SeverityBadge({ severity }: { severity: InventoryGroupingRiskSeverity }) {
  const className = {
    CRITICAL: "border-red-400/30 bg-red-500/15 text-red-100",
    HIGH: "border-orange-400/30 bg-orange-500/15 text-orange-100",
    MEDIUM: "border-yellow-400/30 bg-yellow-500/15 text-yellow-100",
    LOW: "border-white/10 bg-white/5 text-white/70",
  }[severity];

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {severity}
    </span>
  );
}

function highestSeverity(risks: InventoryGroupingRisk[]): InventoryGroupingRiskSeverity {
  if (risks.some((risk) => risk.severity === "CRITICAL")) return "CRITICAL";
  if (risks.some((risk) => risk.severity === "HIGH")) return "HIGH";
  if (risks.some((risk) => risk.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function formatRiskType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function exportRiskCsv(risks: InventoryGroupingRisk[]): void {
  const headers = [
    "Risk",
    "Severity",
    "Category",
    "Product",
    "Manufacturer",
    "Model",
    "Product ID",
    "Inventory Item ID",
    "Identifiers",
    "Location",
    "Recommendation",
  ];
  const rows = risks.flatMap((risk) =>
    risk.inventoryItemIds.map((itemId) => [
      formatRiskType(risk.type),
      risk.severity,
      risk.currentCategory,
      risk.productName,
      risk.manufacturer,
      risk.modelNumber,
      risk.productId,
      itemId,
      risk.identifiers.join(" | "),
      risk.locationName,
      risk.recommendedCleanupAction,
    ])
  );
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `inventory-grouping-risks-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function cleanupSupported(type: InventoryGroupingRiskType): boolean {
  return cleanupActionOptions(type).length > 0;
}

function cleanupActionOptions(type: InventoryGroupingRiskType): InventoryCleanupAction[] {
  switch (type) {
    case "MISSING_CATEGORY":
    case "UNCATEGORIZED":
      return ["ASSIGN_CATEGORY", "MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
    case "MISSING_PRODUCT_ID":
    case "POSSIBLE_DUPLICATE_PRODUCT":
    case "MULTIPLE_PRODUCT_IDS_FOR_SAME_MODEL":
      return ["LINK_CANONICAL_PRODUCT", "RELINK_PRODUCT_ID", "MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
    case "INCONSISTENT_MANUFACTURER":
      return ["CORRECT_MANUFACTURER", "MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
    case "INCONSISTENT_MODEL":
    case "SAME_PRODUCT_ID_DIFFERENT_MODEL":
      return ["CORRECT_MODEL", "MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
    case "INCONSISTENT_PRODUCT_NAME":
      return ["CORRECT_PRODUCT_NAME", "MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
    case "DUPLICATE_SERIAL":
    case "MISSING_SERIAL_FOR_SERIALIZED_ITEM":
      return ["CORRECT_SERIAL", "MARK_AS_REVIEWED"];
    case "DUPLICATE_ASSET_TAG":
      return ["CORRECT_ASSET_TAG", "MARK_AS_REVIEWED"];
    case "DUPLICATE_ASSET_NUMBER":
      return ["CORRECT_ASSET_NUMBER", "MARK_AS_REVIEWED"];
    case "WEAK_PRODUCT_IDENTITY":
      return ["LINK_CANONICAL_PRODUCT", "CORRECT_MANUFACTURER", "CORRECT_MODEL", "MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
    default:
      return ["MARK_AS_REVIEWED", "DISMISS_FALSE_POSITIVE"];
  }
}

function defaultActionForRisk(type: InventoryGroupingRiskType): InventoryCleanupAction {
  return cleanupActionOptions(type)[0] ?? "MARK_AS_REVIEWED";
}

function defaultNewValueForRisk(risk: InventoryGroupingRisk): string {
  if (risk.type === "MISSING_CATEGORY" || risk.type === "UNCATEGORIZED") {
    return "Uncategorized";
  }
  if (risk.type === "INCONSISTENT_MANUFACTURER") return risk.manufacturer === "-" ? "" : risk.manufacturer;
  if (risk.type === "INCONSISTENT_MODEL" || risk.type === "SAME_PRODUCT_ID_DIFFERENT_MODEL") {
    return risk.modelNumber === "-" ? "" : risk.modelNumber;
  }
  if (risk.type === "INCONSISTENT_PRODUCT_NAME") return risk.productName;
  return "";
}

function createOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cleanup-${crypto.randomUUID()}`;
  }
  return `cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
