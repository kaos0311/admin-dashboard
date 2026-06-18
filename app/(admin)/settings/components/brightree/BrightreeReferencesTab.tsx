"use client";

import {
  type ComponentType,
  type Dispatch,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import {
  ClipboardList,
  CreditCard,
  PackageCheck,
  Plus,
  Stethoscope,
  Trash2,
  Truck,
} from "lucide-react";

import { buttons, glass, typography } from "@/theme";

import { BRIGHTREE_REFERENCE_GROUPS } from "../../brightree-reference-data";
import type {
  AppSettings,
  BrightreeReferenceKey,
  BrightreeReferenceRecord,
} from "../../settings-types";

type BrightreeReferencesTabProps = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

type BrightreeReferenceCategory = {
  key: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  lists: BrightreeReferenceKey[];
};

const referenceCategories: BrightreeReferenceCategory[] = [
  {
    key: "insurance-billing",
    label: "Insurance & Billing",
    description: "Payors, plans, payment reasons, and coverage group lists.",
    icon: CreditCard,
    lists: [
      "insuranceGroups",
      "planTypes",
      "insuranceCompanies",
      "paymentReasons",
    ],
  },
  {
    key: "clinical-followup",
    label: "Clinical Follow-Up",
    description: "Practitioner note and patient follow-up reference values.",
    icon: Stethoscope,
    lists: ["practitionerNoteReasons"],
  },
  {
    key: "service-operations",
    label: "Service Operations",
    description: "Pickup, exchange, repair, refusal, and field workflow reasons.",
    icon: Truck,
    lists: ["pickupExchangeReasons"],
  },
  {
    key: "product-catalog",
    label: "Product Catalog",
    description: "Item groups and manufacturer lists used by inventory forms.",
    icon: PackageCheck,
    lists: ["itemGroups", "manufacturers"],
  },
];

const fieldLabels: Record<keyof BrightreeReferenceRecord, string> = {
  id: "ID",
  name: "Name",
  description: "Description",
  group: "Group",
  address: "Address",
  phone: "Phone",
  fax: "Fax",
  itemGroupNo: "Item Group No",
  paymentType: "Payment Type",
};

function newRecord(): BrightreeReferenceRecord {
  return {
    id: `custom-${Date.now()}`,
    name: "",
  };
}

function updateList(
  settings: AppSettings,
  key: BrightreeReferenceKey,
  updater: (records: BrightreeReferenceRecord[]) => BrightreeReferenceRecord[]
): AppSettings {
  return {
    ...settings,
    brightreeReferences: {
      ...settings.brightreeReferences,
      [key]: updater(settings.brightreeReferences[key] ?? []),
    },
  };
}

function getGroup(key: BrightreeReferenceKey) {
  return BRIGHTREE_REFERENCE_GROUPS.find((group) => group.key === key);
}

export function BrightreeReferencesTab({
  settings,
  setSettings,
}: BrightreeReferencesTabProps) {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    referenceCategories[0].key
  );
  const [selectedListKey, setSelectedListKey] =
    useState<BrightreeReferenceKey>(referenceCategories[0].lists[0]);

  const selectedCategory = useMemo(
    () =>
      referenceCategories.find(
        (category) => category.key === selectedCategoryKey
      ) ?? referenceCategories[0],
    [selectedCategoryKey]
  );

  const selectedGroup = getGroup(selectedListKey) ??
    getGroup(selectedCategory.lists[0]);
  const selectedRecords = selectedGroup
    ? settings.brightreeReferences[selectedGroup.key] ?? []
    : [];

  function selectCategory(category: BrightreeReferenceCategory) {
    setSelectedCategoryKey(category.key);
    setSelectedListKey(category.lists[0]);
  }

  function updateRecord(
    key: BrightreeReferenceKey,
    index: number,
    field: keyof BrightreeReferenceRecord,
    value: string
  ) {
    setSettings((current) =>
      updateList(current, key, (records) =>
        records.map((record, recordIndex) =>
          recordIndex === index
            ? {
                ...record,
                [field]: value,
                id:
                  field === "name" && !record.id.startsWith("custom-")
                    ? record.id
                    : record.id,
              }
            : record
        )
      )
    );
  }

  function addRecord(key: BrightreeReferenceKey) {
    setSettings((current) =>
      updateList(current, key, (records) => [...records, newRecord()])
    );
  }

  function removeRecord(key: BrightreeReferenceKey, index: number) {
    setSettings((current) =>
      updateList(current, key, (records) =>
        records.filter((_, recordIndex) => recordIndex !== index)
      )
    );
  }

  return (
    <section className={`${glass.panel} p-5 sm:p-6`}>
      <div className="mb-6">
        <p className={typography.eyebrow}>Brightree references</p>
        <h2 className={typography.sectionTitle}>Dropdown and Autofill Lists</h2>
        <p className={`${typography.bodyMuted} mt-2 max-w-3xl`}>
          Edit the operational reference values used by forms, filters, imports,
          and autofill. Blank names are ignored by consumers until filled in.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {referenceCategories.map((category) => {
            const Icon = category.icon;
            const isSelected = category.key === selectedCategory.key;
            const recordCount = category.lists.reduce(
              (total, key) =>
                total + (settings.brightreeReferences[key] ?? []).length,
              0
            );

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => selectCategory(category)}
                aria-pressed={isSelected}
                className={[
                  "min-h-40 rounded-2xl border p-4 text-left transition",
                  "focus:outline-none focus:ring-2 focus:ring-sky-300/50",
                  isSelected
                    ? "border-sky-300/40 bg-sky-400/15 shadow-lg shadow-sky-950/20"
                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/10",
                ].join(" ")}
              >
                <span className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className={typography.caption}>
                    {recordCount.toLocaleString()} records
                  </span>
                </span>

                <span className={`block ${typography.cardTitle}`}>
                  {category.label}
                </span>
                <span className={`mt-2 block ${typography.bodyMuted}`}>
                  {category.description}
                </span>
              </button>
            );
          })}
        </div>

        <section className={`${glass.inset} p-4`}>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className={typography.eyebrow}>{selectedCategory.label}</p>
              <h3 className={typography.cardTitle}>Reference Lists</h3>
              <p className={`${typography.bodyMuted} mt-1`}>
                Choose a list to edit the values assigned to this category.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {selectedCategory.lists.map((key) => {
              const group = getGroup(key);
              if (!group) return null;

              const records = settings.brightreeReferences[key] ?? [];
              const isSelected = key === selectedListKey;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedListKey(key)}
                  aria-pressed={isSelected}
                  className={[
                    "flex min-h-20 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
                    "focus:outline-none focus:ring-2 focus:ring-sky-300/50",
                    isSelected
                      ? "border-sky-300/40 bg-sky-400/15 text-white"
                      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {group.label}
                    </span>
                    <span className={`mt-1 block ${typography.caption}`}>
                      {records.length.toLocaleString()} record
                      {records.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              );
            })}
          </div>
        </section>

        {selectedGroup ? (
          <section className={`${glass.inset} p-4`}>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className={typography.cardTitle}>{selectedGroup.label}</h3>
                <p className={`${typography.bodyMuted} mt-1`}>
                  {selectedGroup.description}
                </p>
                <p className={`${typography.caption} mt-1`}>
                  {selectedRecords.length.toLocaleString()} record
                  {selectedRecords.length === 1 ? "" : "s"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => addRecord(selectedGroup.key)}
                className={buttons.secondary}
              >
                <Plus className="h-4 w-4" />
                Add Record
              </button>
            </div>

            <div className="space-y-3">
              {selectedRecords.map((record, index) => (
                <div
                  key={`${record.id}-${index}`}
                  className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 xl:grid-cols-[minmax(180px,1.2fr)_repeat(4,minmax(120px,1fr))_auto]"
                >
                  {selectedGroup.fields.map((field) => (
                    <label key={field} className="block">
                      <span className={typography.formLabel}>
                        {fieldLabels[field]}
                      </span>
                      <input
                        value={String(record[field] ?? "")}
                        onChange={(event) =>
                          updateRecord(
                            selectedGroup.key,
                            index,
                            field,
                            event.target.value
                          )
                        }
                        className={`${glass.input} mt-2 px-3 py-2`}
                      />
                    </label>
                  ))}

                  <button
                    type="button"
                    onClick={() => removeRecord(selectedGroup.key, index)}
                    className={`${buttons.danger} self-end px-3 py-2`}
                    aria-label={`Remove ${record.name || selectedGroup.label} record`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {selectedRecords.length === 0 ? (
                <div className={`${glass.inset} p-4 text-sm ${typography.bodyMuted}`}>
                  No records. Add one above, then save settings.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
