"use client";

import { ClipboardCheck } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

import {
  formatDate,
  numberField,
  textField,
} from "../../lib/patientUtils";

type DeliveryField = {
  label: string;
  value?: string;
};

function getNumberText(value: number | undefined): string | undefined {
  return typeof value === "number" ? String(value) : undefined;
}

function getDeliveryFields(
  selected: PatientDetailProps["selected"],
): DeliveryField[] {
  return [
    {
      label: "Sales Order",
      value: textField(selected.deliverySummary, "salesOrderId"),
    },
    {
      label: "Delivery Date",
      value: formatDate(
        textField(selected.deliverySummary, "actualDeliveryDate"),
      ),
    },
    {
      label: "Delivery Tech",
      value: textField(selected.deliverySummary, "deliveryTechName"),
    },
    {
      label: "Delivery Notes",
      value: textField(selected.deliverySummary, "comments"),
    },
    {
      label: "PAR #",
      value: textField(selected.authorization, "parNumber"),
    },
    {
      label: "PAR Status",
      value: textField(selected.authorization, "parStatus"),
    },
    {
      label: "PAR Expiration",
      value: formatDate(textField(selected.authorization, "parExpiration")),
    },
    {
      label: "CMN Status",
      value: textField(selected.cmn, "status"),
    },
    {
      label: "CMN Form",
      value: textField(selected.cmn, "formName"),
    },
    {
      label: "CMN Expiration",
      value: formatDate(textField(selected.cmn, "expiryDate")),
    },
    {
      label: "WIP Status",
      value: textField(selected.wip, "status"),
    },
    {
      label: "WIP Assigned To",
      value: textField(selected.wip, "assignedTo"),
    },
    {
      label: "WIP Days in State",
      value: getNumberText(numberField(selected.wip, "daysInState")),
    },
  ];
}

export function PatientDeliverySection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const deliveryFields = getDeliveryFields(selected);

  return (
    <Section
      title="Delivery / PAR / CMN / WIP"
      icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
    >
      {deliveryFields.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} />
      ))}
    </Section>
  );
}
