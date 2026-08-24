import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import {
  brightreeSection,
  compactAddress,
  inferHospiceStatus,
  patientBaseWrites,
  personName,
  readDateOfDeath,
  readPatientIdentity,
  rowLooksHospice,
} from "./patientMappingUtils";
import {
  clean,
  normalize,
  read,
  toDateString,
} from "./shopRowUtils";

export function patientDemographicWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];
  const hospice = rowLooksHospice(row, patient, "");
  const dateOfDeath = readDateOfDeath(row);
  const demographics = clean({
    lastName: patient.lastName,
    firstName: patient.firstName,
    middleName: read(row, ["Patient Middle Name"]),
    preferredName: read(row, ["Patient Preferred Name"]),
    patientId: patient.patientId,
    accountNumber: read(row, ["Patient Account Number"]),
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    dateOfDeath,
    dod: dateOfDeath,
    sex: read(row, ["Patient Sex"]),
    branchOffice: read(row, ["Patient Branch Office"]),
    branchGroup: read(row, ["Patient Branch Group"]),
    customerType: read(row, ["Patient Customer Type"]),
    facility: read(row, ["Patient Facility"]),
    hospice,
    lastImportId: importId,
  });

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    middleName: read(row, ["Patient Middle Name"]),
    preferredName: read(row, ["Patient Preferred Name"]),
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    dateOfDeath,
    dod: dateOfDeath,
    sex: read(row, ["Patient Sex"]),
    branchOffice: read(row, ["Patient Branch Office"]),
    branchGroup: read(row, ["Patient Branch Group"]),
    customerType: read(row, ["Patient Customer Type"]),
    facility: read(row, ["Patient Facility"]),
    profile: clean({
      demographics,
      branchOffice: read(row, ["Patient Branch Office"]),
      branchGroup: read(row, ["Patient Branch Group"]),
      customerType: read(row, ["Patient Customer Type"]),
      facility: read(row, ["Patient Facility"]),
    }),
    brightree: brightreeSection("demographics", row, importId),
    searchText: normalize([patient.patientId, patient.patientName, patient.dob].join(" ")),
    hospice,
    hospiceStatus: inferHospiceStatus(row, dateOfDeath),
    lastImportId: importId,
  });

  return patientBaseWrites(patient.patientKey, data);
}

export function patientContactWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];
  const hospice = rowLooksHospice(row, patient, "");
  const dateOfDeath = readDateOfDeath(row);
  const billingAddress = compactAddress(row, "Billing Address");
  const deliveryAddress = compactAddress(row, "Delivery Address");
  const contact = clean({
    phone: read(row, ["Billing Address Phone", "Billing Address Mobile Phone", "Delivery Address Phone"]),
    email: read(row, ["Billing Address Email Address"]),
    mobilePhone: read(row, ["Billing Address Mobile Phone"]),
    billingAddress,
    deliveryAddress,
    lastImportId: importId,
  });

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    dateOfDeath,
    dod: dateOfDeath,
    phone: read(row, ["Billing Address Phone", "Billing Address Mobile Phone", "Delivery Address Phone"]),
    email: read(row, ["Billing Address Email Address"]),
    address: read(row, ["Billing Address Address 1", "Delivery Address Address 1"]),
    address2: read(row, ["Billing Address Address 2", "Delivery Address Address 2"]),
    city: read(row, ["Billing Address City", "Delivery Address City"]),
    state: read(row, ["Billing Address State", "Delivery Address State"]),
    zip: read(row, ["Billing Address Postal Code", "Delivery Address Postal Code"]),
    billingAddress,
    deliveryAddress,
    contact,
    profile: clean({ contact, billingAddress, deliveryAddress }),
    brightree: brightreeSection("contact", row, importId),
    searchText: normalize([patient.patientId, patient.patientName, patient.dob, read(row, ["Billing Address Phone"])].join(" ")),
    hospice,
    hospiceStatus: inferHospiceStatus(row, dateOfDeath),
    lastImportId: importId,
  });

  return patientBaseWrites(patient.patientKey, data);
}

export function patientPhysicianWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    primaryDoctor: personName(read(row, ["Primary Doctor First Name"]), read(row, ["Primary Doctor Last Name"])),
    primaryDoctorFirstName: read(row, ["Primary Doctor First Name"]),
    primaryDoctorLastName: read(row, ["Primary Doctor Last Name"]),
    primaryDoctorPhone: read(row, ["Primary Doctor Phone"]),
    primaryDoctorFax: read(row, ["Primary Doctor Fax"]),
    primaryDoctorNpi: read(row, ["Primary Doctor NPI"]),
    orderingDoctor: personName(read(row, ["Ordering Doctor First Name"]), read(row, ["Ordering Doctor Last Name"])),
    orderingDoctorFirstName: read(row, ["Ordering Doctor First Name"]),
    orderingDoctorLastName: read(row, ["Ordering Doctor Last Name"]),
    orderingDoctorPhone: read(row, ["Ordering Doctor Phone"]),
    orderingDoctorFax: read(row, ["Ordering Doctor Fax"]),
    orderingDoctorNpi: read(row, ["Ordering Doctor NPI"]),
    orderingDoctorPecosStatus: read(row, ["Ordering Doctor PECOS Certify Status"]),
    raw: row,
    lastImportId: importId,
  });
  const patientData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    physicians: data,
    profile: clean({
      primaryDoctor: data.primaryDoctor,
      primaryDoctorPhone: data.primaryDoctorPhone,
      primaryDoctorFax: data.primaryDoctorFax,
      primaryDoctorNpi: data.primaryDoctorNpi,
      orderingDoctor: data.orderingDoctor,
      orderingDoctorPhone: data.orderingDoctorPhone,
      orderingDoctorFax: data.orderingDoctorFax,
      orderingDoctorNpi: data.orderingDoctorNpi,
      orderingDoctorPecosStatus: data.orderingDoctorPecosStatus,
    }),
    brightree: brightreeSection("physicians", row, importId),
    searchText: normalize([
      patient.patientId,
      patient.patientName,
      patient.dob,
      data.primaryDoctor,
      data.orderingDoctor,
    ].join(" ")),
    lastImportId: importId,
  });

  return [
    ...patientBaseWrites(patient.patientKey, patientData),
    { path: "patientPhysicians", id: patient.patientKey, data },
  ];
}

export function patientReferralWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    referralType: read(row, ["Referral Type"]),
    referralName: read(row, ["Referral Name"]),
    referralDoctorNpi: read(row, ["Referral Doctor NPI"]),
    referralFacilityNpi: read(row, ["Referral Facility NPI"]),
    referralDoctorGroup: read(row, ["Referral Doctor Group"]),
    referralFacilityGroup: read(row, ["Referral Facility Group"]),
    referringProviderType: read(row, ["Referring Provider Type"]),
    referringProviderName: read(row, ["Referring Provider Name"]),
    referringProviderPhone: read(row, ["Referring Provider Phone"]),
    referringProviderFax: read(row, ["Referring Provider Fax"]),
    referringProviderNpi: read(row, ["Referring Provider NPI"]),
    raw: row,
    lastImportId: importId,
  });
  const patientData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    referrals: data,
    profile: clean({
      referralType: data.referralType,
      referralName: data.referralName,
      referringProviderType: data.referringProviderType,
      referringProviderName: data.referringProviderName,
      referringProviderPhone: data.referringProviderPhone,
      referringProviderFax: data.referringProviderFax,
      referringProviderNpi: data.referringProviderNpi,
    }),
    brightree: brightreeSection("referrals", row, importId),
    searchText: normalize([
      patient.patientId,
      patient.patientName,
      patient.dob,
      data.referralName,
      data.referringProviderName,
    ].join(" ")),
    lastImportId: importId,
  });

  return [
    ...patientBaseWrites(patient.patientKey, patientData),
    { path: "patientReferrals", id: patient.patientKey, data },
  ];
}
