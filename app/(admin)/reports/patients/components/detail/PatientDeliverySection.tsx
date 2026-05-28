"use client";

import {
  ClipboardCheck,
} from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import {
  Info,
  Section,
} from "../PatientUI";

import {
  formatDate,
  numberField,
  textField,
} from "../../lib/patientUtils";

export function PatientDeliverySection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="Delivery / PAR / CMN / WIP"
      icon={
        <ClipboardCheck
          className="h-5 w-5"
          aria-hidden="true"
        />
      }
    >
      <Info
        label="Sales Order"
        value={textField(
          selected.deliverySummary,
          "salesOrderId"
        )}
      />

      <Info
        label="Delivery Date"
        value={formatDate(
          textField(
            selected.deliverySummary,
            "actualDeliveryDate"
          )
        )}
      />

      <Info
        label="Delivery Tech"
        value={textField(
          selected.deliverySummary,
          "deliveryTechName"
        )}
      />

      <Info
        label="Delivery Notes"
        value={textField(
          selected.deliverySummary,
          "comments"
        )}
      />

      <Info
        label="PAR #"
        value={textField(
          selected.authorization,
          "parNumber"
        )}
      />

      <Info
        label="PAR Status"
        value={textField(
          selected.authorization,
          "parStatus"
        )}
      />

      <Info
        label="PAR Expiration"
        value={formatDate(
          textField(
            selected.authorization,
            "parExpiration"
          )
        )}
      />

      <Info
        label="CMN Status"
        value={textField(
          selected.cmn,
          "status"
        )}
      />

      <Info
        label="CMN Form"
        value={textField(
          selected.cmn,
          "formName"
        )}
      />

      <Info
        label="CMN Expiration"
        value={formatDate(
          textField(
            selected.cmn,
            "expiryDate"
          )
        )}
      />

      <Info
        label="WIP Status"
        value={textField(
          selected.wip,
          "status"
        )}
      />

      <Info
        label="WIP Assigned To"
        value={textField(
          selected.wip,
          "assignedTo"
        )}
      />

      <Info
        label="WIP Days in State"
        value={String(
          numberField(
            selected.wip,
            "daysInState"
          ) || ""
        )}
      />
    </Section>
  );
}
