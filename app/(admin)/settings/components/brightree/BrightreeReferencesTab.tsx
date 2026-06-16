"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";

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

export function BrightreeReferencesTab({
  settings,
  setSettings,
}: BrightreeReferencesTabProps) {
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
        {BRIGHTREE_REFERENCE_GROUPS.map((group) => {
          const records = settings.brightreeReferences[group.key] ?? [];

          return (
            <section key={group.key} className={`${glass.inset} p-4`}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className={typography.cardTitle}>{group.label}</h3>
                  <p className={`${typography.bodyMuted} mt-1`}>
                    {group.description}
                  </p>
                  <p className={`${typography.caption} mt-1`}>
                    {records.length.toLocaleString()} record
                    {records.length === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => addRecord(group.key)}
                  className={buttons.secondary}
                >
                  <Plus className="h-4 w-4" />
                  Add Record
                </button>
              </div>

              <div className="space-y-3">
                {records.map((record, index) => (
                  <div
                    key={`${record.id}-${index}`}
                    className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 xl:grid-cols-[minmax(180px,1.2fr)_repeat(4,minmax(120px,1fr))_auto]"
                  >
                    {group.fields.map((field) => (
                      <label key={field} className="block">
                        <span className={typography.formLabel}>
                          {fieldLabels[field]}
                        </span>
                        <input
                          value={String(record[field] ?? "")}
                          onChange={(event) =>
                            updateRecord(
                              group.key,
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
                      onClick={() => removeRecord(group.key, index)}
                      className={`${buttons.danger} self-end px-3 py-2`}
                      aria-label={`Remove ${record.name || group.label} record`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {records.length === 0 ? (
                  <div className={`${glass.inset} p-4 text-sm ${typography.bodyMuted}`}>
                    No records. Add one above, then save settings.
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
