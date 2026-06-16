"use client";

import { useMemo } from "react";
import { ChevronDown, Lock } from "lucide-react";

import { typography } from "@/theme";

import { IMPORT_MODES, REPORT_TYPES } from "../upload-constants";
import type { ImportMode, ReportType } from "../upload-types";
import { cn } from "../upload-utils";
import { uploadUi } from "./upload-ui";

type UploadSettingsCardsProps = {
  reportType: ReportType;
  setReportType: (value: ReportType) => void;
  importMode: ImportMode;
  setImportMode: (value: ImportMode) => void;
  hasActiveUploads: boolean;
};

type SelectCardProps<TValue extends string> = {
  id: string;
  name: string;
  label: string;
  value: TValue;
  disabled: boolean;
  helper?: string;
  options: Array<{
    value: TValue;
    label: string;
  }>;
  onChange: (value: TValue) => void;
};

function SelectCard<TValue extends string>({
  id,
  name,
  label,
  value,
  disabled,
  helper,
  options,
  onChange,
}: SelectCardProps<TValue>) {
  return (
    <label
      className={cn(
        uploadUi.card,
        "block p-4 transition",
        disabled && "opacity-70",
      )}
      htmlFor={id}
    >
      <span className={typography.label}>{label}</span>

      <div className="relative mt-2">
        <select
          id={id}
          name={name}
          title={label}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value as TValue)}
          className={cn(
            uploadUi.input,
            "appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-70",
          )}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {disabled ? (
          <Lock
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
        )}
      </div>

      {helper ? (
        <p className={cn(typography.bodyMuted, "mt-2 text-xs")}>{helper}</p>
      ) : null}
    </label>
  );
}

export function UploadSettingsCards({
  reportType,
  setReportType,
  importMode,
  setImportMode,
  hasActiveUploads,
}: UploadSettingsCardsProps) {
  const selectedReportType = useMemo(
    () => REPORT_TYPES.find((item) => item.value === reportType),
    [reportType],
  );

  const selectedImportMode = useMemo(
    () => IMPORT_MODES.find((item) => item.value === importMode),
    [importMode],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SelectCard
        id="report-type"
        name="reportType"
        label="Report type"
        value={reportType}
        disabled={hasActiveUploads}
        helper={selectedReportType?.helper}
        options={REPORT_TYPES}
        onChange={setReportType}
      />

      <SelectCard
        id="import-mode"
        name="importMode"
        label="Import mode"
        value={importMode}
        disabled={hasActiveUploads}
        helper={selectedImportMode?.description}
        options={IMPORT_MODES}
        onChange={setImportMode}
      />
    </div>
  );
}




