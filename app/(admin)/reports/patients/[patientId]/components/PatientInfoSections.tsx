import {
  Banknote,
  CalendarCheck2,
  ClipboardCheck,
  HeartPulse,
  PackageCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { badges, glass, typography } from "@/theme";

import type { PatientRecord } from "../patient-detail-types";

import {
  getCpapEligibility,
  isMedicarePatient,
} from "../../lib/cpapEligibility";

import {
  formatDate,
  formatMoney,
  numberField,
  textField,
} from "../patient-detail-utils";

import { EquipmentTable } from "./EquipmentTable";
import { Info, Section } from "./PatientDetailPrimitives";
import { PurchaseTable } from "./PurchaseTable";

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }

  return "";
}

function sectionField(
  patient: PatientRecord,
  section: string,
  ...keys: string[]
): string {
  const brightree = recordValue(patient.brightree);
  const source = recordValue(brightree?.[section]);

  if (!source) return "";

  for (const key of keys) {
    const exact = cleanText(source[key]);
    if (exact) return exact;

    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const match = Object.entries(source).find(
      ([sourceKey]) =>
        sourceKey.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedKey,
    );

    if (match) {
      const text = cleanText(match[1]);
      if (text) return text;
    }
  }

  return "";
}

function profileSectionField(
  patient: PatientRecord,
  section: string,
  ...keys: string[]
): string {
  const source = recordValue(patient.profile?.[section]);

  if (!source) return "";

  return firstText(...keys.map((key) => source[key]));
}

function equipmentText(patient: PatientRecord, category: string): string {
  const text = category.toLowerCase();
  const item = (patient.currentEquipment ?? []).find((equipment) => {
    const name = cleanText(equipment.itemName).toLowerCase();
    const hcpc = cleanText(equipment.hcpc).toLowerCase();
    const equipmentCategory = cleanText(equipment.category).toLowerCase();

    if (text === "machine") {
      return /cpap|bipap|pap/.test(name) || /e0601|e0470|e0471/.test(hcpc);
    }

    if (text === "humidifier") {
      return name.includes("humidifier") || hcpc.includes("e0562");
    }

    if (text === "tubing") {
      return name.includes("tubing") || hcpc.includes("a7037");
    }

    if (text === "filters") {
      return name.includes("filter") || hcpc.includes("a7038") || hcpc.includes("a7039");
    }

    if (text === "headgear") {
      return name.includes("headgear") || hcpc.includes("a7035");
    }

    if (text === "mask") {
      return name.includes("mask") || /a7030|a7034/.test(hcpc);
    }

    return equipmentCategory.includes(text) || name.includes(text);
  });

  return firstText(item?.itemName, item?.serialNumber, item?.hcpc);
}

function equipmentSerial(patient: PatientRecord): string {
  const item = (patient.currentEquipment ?? []).find((equipment) => {
    const name = cleanText(equipment.itemName).toLowerCase();
    const hcpc = cleanText(equipment.hcpc).toLowerCase();

    return /cpap|bipap|pap/.test(name) || /e0601|e0470|e0471/.test(hcpc);
  });

  return cleanText(item?.serialNumber);
}

export function PatientInfoSections({ patient }: { patient: PatientRecord }) {
  return (
    <>
      <PatientIdentityClinicalSections patient={patient} />
      <PatientCpapEquipmentSections patient={patient} />
      <PatientOrdersBillingSections patient={patient} />
    </>
  );
}

export function PatientIdentityClinicalSections({
  patient,
}: {
  patient: PatientRecord;
}) {
  const primaryDoctor = firstText(
    textField(patient.profile, "primaryDoctor"),
    sectionField(patient, "physicians", "Primary Doctor First Name") &&
      `${sectionField(patient, "physicians", "Primary Doctor First Name")} ${sectionField(patient, "physicians", "Primary Doctor Last Name")}`,
  );
  const orderingDoctor = firstText(
    textField(patient.profile, "orderingDoctor"),
    sectionField(patient, "physicians", "Ordering Doctor First Name") &&
      `${sectionField(patient, "physicians", "Ordering Doctor First Name")} ${sectionField(patient, "physicians", "Ordering Doctor Last Name")}`,
  );

  return (
    <>
      <Section title="Patient Identity" icon={<UserRound className="h-5 w-5" />}>
        <Info label="First Name" value={patient.firstName} />
        <Info label="Last Name" value={patient.lastName} />
        <Info
          label="Phone"
          value={firstText(patient.phone, sectionField(patient, "contact", "Billing Address Phone", "Billing Address Mobile Phone", "Delivery Address Phone"))}
        />
        <Info label="Email" value={firstText(patient.email, sectionField(patient, "contact", "Billing Address Email Address"))} />
        <Info label="Address" value={firstText(patient.address, sectionField(patient, "contact", "Billing Address Address 1", "Delivery Address Address 1"))} />
        <Info label="City" value={firstText(patient.city, sectionField(patient, "contact", "Billing Address City", "Delivery Address City"))} />
        <Info label="State" value={firstText(patient.state, sectionField(patient, "contact", "Billing Address State", "Delivery Address State"))} />
        <Info label="ZIP" value={firstText(patient.zip, sectionField(patient, "contact", "Billing Address Postal Code", "Delivery Address Postal Code"))} />
        <Info label="Sex" value={firstText(textField(patient.profile, "sex"), profileSectionField(patient, "demographics", "sex"), sectionField(patient, "demographics", "Patient Sex"))} />
        <Info label="Height" value={firstText(textField(patient.profile, "height"), sectionField(patient, "demographics", "Height"))} />
        <Info label="Weight" value={firstText(textField(patient.profile, "weight"), sectionField(patient, "demographics", "Weight"))} />
        <Info
          label="Patient ID"
          value={firstText(patient.patientId, textField(patient.profile, "patientId"), profileSectionField(patient, "demographics", "patientId"), sectionField(patient, "demographics", "Patient ID"))}
        />
        <Info
          label="Account #"
          value={firstText(textField(patient.profile, "accountNumber"), profileSectionField(patient, "demographics", "accountNumber"), sectionField(patient, "demographics", "Patient Account Number"))}
        />
        <Info
          label="Patient Status"
          value={firstText(textField(patient.profile, "patientStatus"), textField(patient.profile, "customerType"), profileSectionField(patient, "demographics", "customerType"), sectionField(patient, "demographics", "Patient Customer Type"))}
        />
        <Info
          label="Hub Status"
          value={firstText(textField(patient.profile, "patientHubStatus"), textField(patient.profile, "branchOffice"), profileSectionField(patient, "demographics", "branchOffice"), sectionField(patient, "demographics", "Patient Branch Office"))}
        />
        <Info
          label="Branch Group"
          value={textField(patient.profile, "branchGroup")}
        />
        <Info
          label="Account Group"
          value={textField(patient.profile, "accountGroup")}
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
            textField(patient.insurance, "payor") ||
            sectionField(patient, "referrals", "Referral Name")
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
          value={primaryDoctor}
        />
        <Info
          label="Ordering Doctor"
          value={orderingDoctor}
        />
        <Info
          label="Registration Date"
          value={formatDate(textField(patient.profile, "registrationDate"))}
        />
        <Info
          label="Last Portal Login"
          value={formatDate(textField(patient.profile, "lastLoginDate"))}
        />
        <Info
          label="Referral"
          value={firstText(textField(patient.profile, "referralName"), sectionField(patient, "referrals", "Referral Name"))}
        />
        <Info
          label="Therapy"
          value={firstText(textField(patient.profile, "therapyName"), textField(patient.profile, "therapyType"))}
        />
      </Section>
    </>
  );
}

export function PatientCpapEquipmentSections({
  patient,
}: {
  patient: PatientRecord;
}) {
  const cpapEligibility = getCpapEligibility(patient);
  const medicare = isMedicarePatient(patient);
  const statusClasses = {
    ready: badges.success,
    soon: badges.warning,
    future: badges.neutral,
    missing: badges.info,
  };
  const cpapMachine = firstText(patient.cpap?.machine, equipmentText(patient, "machine"));
  const cpapMask = firstText(patient.cpap?.maskType, equipmentText(patient, "mask"));

  return (
    <>
      <Section
        title="CPAP / PAP Therapy"
        icon={<HeartPulse className="h-5 w-5" />}
      >
        <Info label="On Record" value={patient.cpap?.onRecord || cpapMachine ? "Yes" : "No"} />
        <Info label="Machine" value={cpapMachine} />
        <Info label="Mask Type" value={cpapMask} />
        <Info label="Humidifier" value={firstText(patient.cpap?.humidifier, equipmentText(patient, "humidifier"))} />
        <Info label="Tubing" value={firstText(patient.cpap?.tubing, equipmentText(patient, "tubing"))} />
        <Info label="Filters" value={firstText(patient.cpap?.filters, equipmentText(patient, "filters"))} />
        <Info label="Headgear" value={firstText(patient.cpap?.headgear, equipmentText(patient, "headgear"))} />
        <Info label="Pressure" value={patient.cpap?.pressure} />
        <Info label="Serial #" value={firstText(patient.cpap?.serialNumber, equipmentSerial(patient))} />
        <Info label="Setup Date" value={formatDate(patient.cpap?.setupDate)} />
        <Info
          label="Last Service"
          value={formatDate(patient.cpap?.lastServiceDate)}
        />
        <Info label="Compliance" value={patient.cpap?.complianceStatus} />

        <div className="md:col-span-3">
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 shrink-0 text-cyan-200" />
            <h4 className={typography.bodyStrong}>CPAP Supply Eligibility</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className={typography.caption}>
                  <th className="w-[24%] px-3 py-2">Supply</th>
                  <th className="w-[18%] px-3 py-2">Allowed</th>
                  <th className="w-[16%] px-3 py-2">Last</th>
                  <th className="w-[16%] px-3 py-2">Next</th>
                  <th className="w-[14%] px-3 py-2">Qty</th>
                  <th className="w-[12%] px-3 py-2">Status</th>
                </tr>
              </thead>

              <tbody>
                {cpapEligibility.map((row) => (
                  <tr key={row.rule.id} className={glass.inset}>
                    <td className="rounded-l-lg px-3 py-3 align-top">
                      <p className={typography.bodyStrong}>{row.rule.label}</p>
                      <p className={typography.smallMuted}>
                        {row.rule.hcpcs.join(", ")}
                      </p>
                    </td>
                    <td className={`${typography.small} px-3 py-3 align-top`}>
                      {row.rule.description}
                    </td>
                    <td className={`${typography.small} px-3 py-3 align-top`}>
                      {formatDate(row.lastReceivedDate)}
                    </td>
                    <td className={`${typography.small} px-3 py-3 align-top`}>
                      {formatDate(row.nextEligibleDate)}
                    </td>
                    <td className={`${typography.small} px-3 py-3 align-top`}>
                      {medicare
                        ? row.rule.medicareThreeMonthQuantity
                        : row.rule.standardQuantity}
                    </td>
                    <td className="rounded-r-lg px-3 py-3 align-top">
                      <span className={`${glass.chip} ${statusClasses[row.status]}`}>
                        {row.status === "ready"
                          ? "Ready"
                          : row.status === "soon"
                            ? "Soon"
                            : row.status === "missing"
                              ? "Verify"
                              : "Future"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section
        title="Current Equipment"
        icon={<PackageCheck className="h-5 w-5" />}
      >
        <div className="md:col-span-3">
          <EquipmentTable items={patient.currentEquipment ?? []} />
        </div>
      </Section>
    </>
  );
}

export function PatientOrdersBillingSections({
  patient,
}: {
  patient: PatientRecord;
}) {
  return (
    <>
      <Section
        title="Purchases Last 90 Days"
        icon={<Banknote className="h-5 w-5" />}
      >
        <div className="md:col-span-3">
          <PurchaseTable items={patient.purchasesLast90Days ?? []} />
        </div>
      </Section>

      <div id="wip" className="scroll-mt-24">
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
      </div>

      <Section
        title="PAR Authorization Lines"
        icon={<ClipboardCheck className="h-5 w-5" />}
      >
        <div className="md:col-span-3">
          {patient.authorizationLines?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className={typography.caption}>
                    <th className="w-[13%] px-3 py-2">PAR</th>
                    <th className="w-[24%] px-3 py-2">Item</th>
                    <th className="w-[10%] px-3 py-2">HCPCS</th>
                    <th className="w-[18%] px-3 py-2">Insurance</th>
                    <th className="w-[12%] px-3 py-2">Expires</th>
                    <th className="w-[12%] px-3 py-2">Order</th>
                    <th className="w-[11%] px-3 py-2">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {patient.authorizationLines.map((line) => (
                    <tr key={line.id} className={glass.inset}>
                      <td className={`${typography.small} rounded-l-lg px-3 py-3 align-top`}>
                        <p className={typography.bodyStrong}>{line.parNumber || "—"}</p>
                        <p className={typography.smallMuted}>{line.branchOffice}</p>
                        {line.sourceReport ? (
                          <p className={typography.smallMuted}>
                            Source {line.sourceReport}{line.sourceRentalId ? ` · ${line.sourceRentalId}` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className={typography.bodyStrong}>{line.itemName || "—"}</p>
                        <p className={typography.smallMuted}>{line.itemId}</p>
                      </td>
                      <td className={`${typography.small} px-3 py-3 align-top`}>
                        {line.procedureCode || "—"}
                      </td>
                      <td className={`${typography.small} px-3 py-3 align-top`}>
                        <p>{line.insurance || "—"}</p>
                        <p className={typography.smallMuted}>{line.policyNumber}</p>
                      </td>
                      <td className={`${typography.small} px-3 py-3 align-top`}>
                        {formatDate(line.parExpiration)}
                      </td>
                      <td className={`${typography.small} px-3 py-3 align-top`}>
                        <p>{line.salesOrderId || "—"}</p>
                        <p className={typography.smallMuted}>{formatDate(line.actualDeliveryDate)}</p>
                      </td>
                      <td className="rounded-r-lg px-3 py-3 align-top">
                        <span className={`${glass.chip} ${badges.neutral}`}>
                          {line.parStatus || "Review"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={glass.emptyState}>
              <p className={typography.bodyStrong}>No PAR line records loaded.</p>
              <p className={["mt-2", typography.bodyMuted].join(" ")}>
                Upload or reprocess the PAR report to attach authorization lines to this patient chart.
              </p>
            </div>
          )}
        </div>
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
        <Info
          label="Invoice Status"
          value={textField(patient.billing, "invoiceStatus")}
        />
        <Info
          label="Service Date"
          value={formatDate(textField(patient.billing, "invoiceServiceDate"))}
        />
        <Info
          label="Payment Posted"
          value={formatDate(textField(patient.billing, "paymentPostedDate"))}
        />
        <Info
          label="Payment Reason"
          value={textField(patient.billing, "paymentReason")}
        />
      </Section>
    </>
  );
}

