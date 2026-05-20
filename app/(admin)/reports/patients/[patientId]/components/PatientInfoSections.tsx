import {
  Banknote,
  ClipboardCheck,
  HeartPulse,
  PackageCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import type { PatientRecord } from "../patient-detail-types";

import {
  formatDate,
  formatMoney,
  numberField,
  textField,
} from "../patient-detail-utils";

import { EquipmentTable } from "./EquipmentTable";
import { Info, Section } from "./PatientDetailPrimitives";
import { PurchaseTable } from "./PurchaseTable";

export function PatientInfoSections({ patient }: { patient: PatientRecord }) {
  return (
    <>
      <Section title="Patient Identity" icon={<UserRound className="h-5 w-5" />}>
        <Info label="First Name" value={patient.firstName} />
        <Info label="Last Name" value={patient.lastName} />
        <Info label="Phone" value={patient.phone} />
        <Info label="Email" value={patient.email} />
        <Info label="Address" value={patient.address} />
        <Info label="City" value={patient.city} />
        <Info label="State" value={patient.state} />
        <Info label="ZIP" value={patient.zip} />
        <Info label="Sex" value={textField(patient.profile, "sex")} />
        <Info label="Height" value={textField(patient.profile, "height")} />
        <Info label="Weight" value={textField(patient.profile, "weight")} />
        <Info
          label="Patient ID"
          value={textField(patient.profile, "patientId")}
        />
        <Info
          label="Account #"
          value={textField(patient.profile, "accountNumber")}
        />
        <Info
          label="Patient Status"
          value={textField(patient.profile, "patientStatus")}
        />
        <Info
          label="Hub Status"
          value={textField(patient.profile, "patientHubStatus")}
        />
      </Section>

      <Section
        title="Insurance / Clinical"
        icon={<Stethoscope className="h-5 w-5" />}
      >
        <Info
          label="Primary Insurance"
          value={
            textField(patient.insurance, "primaryInsurance") ||
            textField(patient.insurance, "payor")
          }
        />
        <Info
          label="Secondary Insurance"
          value={textField(patient.insurance, "secondaryInsurance")}
        />
        <Info
          label="Policy #"
          value={textField(patient.insurance, "policyNumber")}
        />
        <Info
          label="Insurance Status"
          value={textField(patient.insurance, "insuranceStatus")}
        />
        <Info
          label="Coverage Type"
          value={textField(patient.insurance, "coverageTypes")}
        />
        <Info
          label="Primary Doctor"
          value={textField(patient.profile, "primaryDoctor")}
        />
        <Info
          label="Ordering Doctor"
          value={textField(patient.profile, "orderingDoctor")}
        />
        <Info
          label="Registration Date"
          value={formatDate(textField(patient.profile, "registrationDate"))}
        />
        <Info
          label="Last Portal Login"
          value={formatDate(textField(patient.profile, "lastLoginDate"))}
        />
      </Section>

      <Section
        title="CPAP / PAP Therapy"
        icon={<HeartPulse className="h-5 w-5" />}
      >
        <Info label="On Record" value={patient.cpap?.onRecord ? "Yes" : "No"} />
        <Info label="Machine" value={patient.cpap?.machine} />
        <Info label="Mask Type" value={patient.cpap?.maskType} />
        <Info label="Humidifier" value={patient.cpap?.humidifier} />
        <Info label="Tubing" value={patient.cpap?.tubing} />
        <Info label="Filters" value={patient.cpap?.filters} />
        <Info label="Headgear" value={patient.cpap?.headgear} />
        <Info label="Pressure" value={patient.cpap?.pressure} />
        <Info label="Serial #" value={patient.cpap?.serialNumber} />
        <Info label="Setup Date" value={formatDate(patient.cpap?.setupDate)} />
        <Info
          label="Last Service"
          value={formatDate(patient.cpap?.lastServiceDate)}
        />
        <Info label="Compliance" value={patient.cpap?.complianceStatus} />
      </Section>

      <Section
        title="Current Equipment"
        icon={<PackageCheck className="h-5 w-5" />}
      >
        <div className="md:col-span-3">
          <EquipmentTable items={patient.currentEquipment ?? []} />
        </div>
      </Section>

      <Section
        title="Purchases Last 90 Days"
        icon={<Banknote className="h-5 w-5" />}
      >
        <div className="md:col-span-3">
          <PurchaseTable items={patient.purchasesLast90Days ?? []} />
        </div>
      </Section>

      <Section
        title="Delivery / PAR / CMN / WIP"
        icon={<ClipboardCheck className="h-5 w-5" />}
      >
        <Info
          label="Sales Order"
          value={textField(patient.deliverySummary, "salesOrderId")}
        />
        <Info
          label="Delivery Date"
          value={formatDate(
            textField(patient.deliverySummary, "actualDeliveryDate")
          )}
        />
        <Info
          label="Delivery Tech"
          value={textField(patient.deliverySummary, "deliveryTechName")}
        />
        <Info
          label="Delivery Notes"
          value={textField(patient.deliverySummary, "comments")}
        />
        <Info
          label="PAR #"
          value={textField(patient.authorization, "parNumber")}
        />
        <Info
          label="PAR Status"
          value={textField(patient.authorization, "parStatus")}
        />
        <Info
          label="PAR Expiration"
          value={formatDate(textField(patient.authorization, "parExpiration"))}
        />
        <Info label="CMN Status" value={textField(patient.cmn, "status")} />
        <Info label="CMN Form" value={textField(patient.cmn, "formName")} />
        <Info
          label="CMN Expiration"
          value={formatDate(textField(patient.cmn, "expiryDate"))}
        />
        <Info label="WIP Status" value={textField(patient.wip, "status")} />
        <Info
          label="WIP Assigned To"
          value={textField(patient.wip, "assignedTo")}
        />
        <Info
          label="WIP Days in State"
          value={String(numberField(patient.wip, "daysInState") || "")}
        />
      </Section>

      <Section title="Billing Snapshot" icon={<Banknote className="h-5 w-5" />}>
        <Info
          label="Last Invoice Date"
          value={formatDate(textField(patient.billing, "lastInvoiceDate"))}
        />
        <Info
          label="Last Payment Date"
          value={formatDate(textField(patient.billing, "lastPaymentDate"))}
        />
        <Info
          label="Charges 90 Days"
          value={formatMoney(numberField(patient.billing, "totalCharges90Days"))}
        />
        <Info
          label="Allowed 90 Days"
          value={formatMoney(numberField(patient.billing, "totalAllowed90Days"))}
        />
        <Info
          label="Payments 90 Days"
          value={formatMoney(
            numberField(patient.billing, "totalPayments90Days")
          )}
        />
        <Info
          label="Open Balance Estimate"
          value={formatMoney(
            numberField(patient.billing, "openBalanceEstimate")
          )}
        />
      </Section>
    </>
  );
}