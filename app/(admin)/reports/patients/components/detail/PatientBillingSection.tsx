"use client";

import { Banknote } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

import {
  formatDate,
  formatMoney,
  numberField,
  textField,
} from "../../lib/patientUtils";

type BillingField = {
  label: string;
  value: string;
};

function getBillingFields(
  selected: PatientDetailProps["selected"],
): BillingField[] {
  return [
    {
      label: "Last Invoice Date",
      value: formatDate(textField(selected.billing, "lastInvoiceDate")),
    },
    {
      label: "Last Payment Date",
      value: formatDate(textField(selected.billing, "lastPaymentDate")),
    },
    {
      label: "Charges 90 Days",
      value: formatMoney(numberField(selected.billing, "totalCharges90Days")),
    },
    {
      label: "Allowed 90 Days",
      value: formatMoney(numberField(selected.billing, "totalAllowed90Days")),
    },
    {
      label: "Payments 90 Days",
      value: formatMoney(numberField(selected.billing, "totalPayments90Days")),
    },
    {
      label: "Open Balance Estimate",
      value: formatMoney(numberField(selected.billing, "openBalanceEstimate")),
    },
  ];
}

export function PatientBillingSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const billingFields = getBillingFields(selected);

  return (
    <Section
      title="Billing Snapshot"
      icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
    >
      {billingFields.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} />
      ))}
    </Section>
  );
}
