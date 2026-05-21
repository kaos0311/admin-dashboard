"use client";

import { Banknote } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import {
  Info,
  Section,
} from "../PatientUI";

import {
  formatDate,
  formatMoney,
  numberField,
  textField,
} from "../../lib/patientUtils";

export function PatientBillingSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="Billing Snapshot"
      icon={
        <Banknote
          className="h-5 w-5"
          aria-hidden="true"
        />
      }
    >
      <Info
        label="Last Invoice Date"
        value={formatDate(
          textField(
            selected.billing,
            "lastInvoiceDate"
          )
        )}
      />

      <Info
        label="Last Payment Date"
        value={formatDate(
          textField(
            selected.billing,
            "lastPaymentDate"
          )
        )}
      />

      <Info
        label="Charges 90 Days"
        value={formatMoney(
          numberField(
            selected.billing,
            "totalCharges90Days"
          )
        )}
      />

      <Info
        label="Allowed 90 Days"
        value={formatMoney(
          numberField(
            selected.billing,
            "totalAllowed90Days"
          )
        )}
      />

      <Info
        label="Payments 90 Days"
        value={formatMoney(
          numberField(
            selected.billing,
            "totalPayments90Days"
          )
        )}
      />

      <Info
        label="Open Balance Estimate"
        value={formatMoney(
          numberField(
            selected.billing,
            "openBalanceEstimate"
          )
        )}
      />
    </Section>
  );
}