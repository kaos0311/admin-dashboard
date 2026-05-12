export type Primitive = string | number | boolean | null | undefined;

export type ImportedPatientRow = {
  id: string;
  sourceReportId: string;
  reportType?: string | null;
  createdAt?: unknown;
  data: Record<string, Primitive>;
};

export type PatientProfile = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  fullName: string;
  originalFullName: string;
  dateOfBirth: string;
  searchText: string;
  demographics: Record<string, Primitive>;
  biography: Record<string, Primitive>;
  items: Array<Record<string, Primitive>>;
  purchases: Array<Record<string, Primitive>>;
  rentals: Array<Record<string, Primitive>>;
  rows: ImportedPatientRow[];
  sourceReportIds: string[];
};

const FIRST_NAME_KEYS = [
  "first_name",
  "firstname",
  "first",
  "patient_first_name",
  "patientfirstname",
  "pt_first_name",
  "ptfirstname",
];

const LAST_NAME_KEYS = [
  "last_name",
  "lastname",
  "last",
  "patient_last_name",
  "patientlastname",
  "pt_last_name",
  "ptlastname",
];

const DOB_KEYS = [
  "date_of_birth",
  "dob",
  "birth_date",
  "birthdate",
  "patient_dob",
  "pt_dob",
];

const FULL_NAME_KEYS = [
  "fullname",
  "full_name",
  "patient_name",
  "ptname",
  "patientfullname",
  "patient_full_name",
];

const DEMOGRAPHIC_KEYS = [
  "gender",
  "sex",
  "phone",
  "phone_number",
  "mobile",
  "cell",
  "ptbillphone",
  "ptdelivphone",
  "email",
  "address",
  "address_1",
  "address_2",
  "city",
  "state",
  "zip",
  "zip_code",
  "postal_code",
  "ptbilladdr",
  "ptbillcitystzip",
  "ptdelivaddr",
  "ptdelivcitystzip",
  "county",
  "country",
  "dcounty",
  "dcountry",
  "insurance",
  "insurance_name",
  "payer",
  "payor",
  "payer_name",
  "orderingdocname",
  "primarydocname",
  "mrn",
  "medicare_id",
  "medicaid_id",
  "patient_id",
  "ptid",
  "ptkey",
  "account_number",
  "acctno",
  "patientstatus",
  "patientstatuskey",
  "registration_date",
  "last_login_date",
];

const ITEM_KEYS = [
  "item",
  "item_name",
  "product",
  "product_name",
  "sku",
  "hcpcs",
  "serial",
  "serial_number",
  "quantity",
];

const PURCHASE_KEYS = [
  "sale_date",
  "purchase_date",
  "invoice",
  "invoice_number",
  "order",
  "order_id",
  "amount",
  "price",
  "total",
  "paid",
  "payment_status",
];

const RENTAL_KEYS = [
  "rental",
  "rental_date",
  "start_date",
  "end_date",
  "next_bill_date",
  "monthly_amount",
  "months",
  "rental_status",
  "startdt",
  "enddt",
  "expdate",
];

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[.\-/\s]+/g, "_")
    .replace(/_+/g, "_");
}

function asCleanString(value: Primitive): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function firstNonEmptyValue(
  data: Record<string, Primitive>,
  keys: string[]
): string {
  for (const key of keys) {
    const found = data[key];
    const text = asCleanString(found);
    if (text) return text;
  }

  return "";
}

function safeProfileKey(lastName: string, firstName: string, dob: string): string {
  const base = `${lastName}|${firstName}|${dob}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "_")
    .replace(/_+/g, "_");

  return base || "unknown_patient";
}

function pickFields(
  data: Record<string, Primitive>,
  keys: string[]
): Record<string, Primitive> {
  const picked: Record<string, Primitive> = {};

  for (const [key, value] of Object.entries(data)) {
    if (keys.includes(key) && value !== null && value !== undefined && String(value).trim() !== "") {
      picked[key] = value;
    }
  }

  return picked;
}

function compactRowData(
  data: Record<string, Primitive>
): Record<string, Primitive> {
  const result: Record<string, Primitive> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text) continue;
    result[key] = value;
  }

  return result;
}

function inferCategory(
  row: ImportedPatientRow
): "demographics" | "items" | "purchases" | "rentals" | "biography" {
  const reportType = (row.reportType || "").toLowerCase();
  const keys = Object.keys(row.data);

  if (reportType.includes("rental")) return "rentals";
  if (reportType.includes("sale") || reportType.includes("purchase")) return "purchases";
  if (reportType.includes("item") || reportType.includes("product")) return "items";
  if (reportType.includes("demographic")) return "demographics";
  if (reportType.includes("patient")) return "biography";

  if (keys.some((key) => RENTAL_KEYS.includes(key))) return "rentals";
  if (keys.some((key) => PURCHASE_KEYS.includes(key))) return "purchases";
  if (keys.some((key) => ITEM_KEYS.includes(key))) return "items";
  if (keys.some((key) => DEMOGRAPHIC_KEYS.includes(key))) return "demographics";

  return "biography";
}

function mergeFlatObjects(
  target: Record<string, Primitive>,
  source: Record<string, Primitive>
): Record<string, Primitive> {
  const next = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const current = next[key];
    const incoming = asCleanString(value);

    if (!incoming) continue;
    if (!asCleanString(current)) {
      next[key] = value;
    }
  }

  return next;
}

function titleCaseWord(word: string): string {
  const cleaned = word.trim();
  if (!cleaned) return "";

  if (cleaned.length === 1) {
    return cleaned.toUpperCase();
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function titleCaseNamePart(part: string): string {
  return part
    .split(/\s+/)
    .filter(Boolean)
    .map((piece) =>
      piece
        .split("-")
        .map(titleCaseWord)
        .join("-")
    )
    .join(" ");
}

function normalizeDobText(value: string): string {
  return value.replace(/\s+12:00:00\s+AM$/i, "").trim();
}

function parseBrightreeFullName(fullname: string): {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  fullName: string;
  originalFullName: string;
} {
  const originalFullName = fullname.trim().replace(/\s+/g, " ");
  if (!originalFullName) {
    return {
      firstName: "",
      lastName: "",
      middleName: "",
      suffix: "",
      fullName: "",
      originalFullName: "",
    };
  }

  const suffixList = new Set(["JR", "SR", "II", "III", "IV", "V"]);

  let firstName = "";
  let lastName = "";
  let middleName = "";
  let suffix = "";

  if (originalFullName.includes(",")) {
    const [rawLast, rawRest] = originalFullName.split(",", 2);
    lastName = titleCaseNamePart(rawLast || "");

    const restParts = (rawRest || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (restParts.length > 0) {
      firstName = titleCaseNamePart(restParts[0]);
    }

    if (restParts.length > 1) {
      const maybeSuffix = restParts[restParts.length - 1].replace(/\./g, "").toUpperCase();

      if (suffixList.has(maybeSuffix)) {
        suffix = maybeSuffix;
        middleName = restParts
          .slice(1, -1)
          .map(titleCaseNamePart)
          .join(" ");
      } else {
        middleName = restParts
          .slice(1)
          .map(titleCaseNamePart)
          .join(" ");
      }
    }
  } else {
    const parts = originalFullName.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      firstName = titleCaseNamePart(parts[0]);
    } else if (parts.length >= 2) {
      firstName = titleCaseNamePart(parts[0]);

      const maybeSuffix = parts[parts.length - 1].replace(/\./g, "").toUpperCase();

      if (suffixList.has(maybeSuffix)) {
        suffix = maybeSuffix;
        lastName = titleCaseNamePart(parts[parts.length - 2]);
        middleName = parts
          .slice(1, -2)
          .map(titleCaseNamePart)
          .join(" ");
      } else {
        lastName = titleCaseNamePart(parts[parts.length - 1]);
        middleName = parts
          .slice(1, -1)
          .map(titleCaseNamePart)
          .join(" ");
      }
    }
  }

  const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(" ").trim();

  return {
    firstName,
    lastName,
    middleName,
    suffix,
    fullName,
    originalFullName,
  };
}

function extractNameParts(data: Record<string, Primitive>): {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  fullName: string;
  originalFullName: string;
} {
  const explicitFirstName = firstNonEmptyValue(data, FIRST_NAME_KEYS);
  const explicitLastName = firstNonEmptyValue(data, LAST_NAME_KEYS);
  const rawFullName = firstNonEmptyValue(data, FULL_NAME_KEYS);

  if (explicitFirstName && explicitLastName) {
    const firstName = titleCaseNamePart(explicitFirstName);
    const lastName = titleCaseNamePart(explicitLastName);
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      firstName,
      lastName,
      middleName: "",
      suffix: "",
      fullName,
      originalFullName: rawFullName || fullName,
    };
  }

  if (rawFullName) {
    return parseBrightreeFullName(rawFullName);
  }

  return {
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    fullName: "",
    originalFullName: "",
  };
}

export function normalizeImportedRow(
  id: string,
  sourceReportId: string,
  reportType: string | null | undefined,
  raw: Record<string, unknown>
): ImportedPatientRow {
  const normalized: Record<string, Primitive> = {};

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (
      rawKey === "sourceReportId" ||
      rawKey === "reportType" ||
      rawKey === "createdAt"
    ) {
      continue;
    }

    const key = normalizeKey(rawKey);

    if (!key) continue;

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null ||
      rawValue === undefined
    ) {
      normalized[key] = rawValue;
    } else {
      normalized[key] = String(rawValue);
    }
  }

  return {
    id,
    sourceReportId,
    reportType: reportType ?? null,
    data: normalized,
  };
}

export function buildPatientProfiles(rows: ImportedPatientRow[]): PatientProfile[] {
  const map = new Map<string, PatientProfile>();

  for (const row of rows) {
    const parsedName = extractNameParts(row.data);
    const firstName = parsedName.firstName;
    const lastName = parsedName.lastName;
    const dateOfBirth = normalizeDobText(firstNonEmptyValue(row.data, DOB_KEYS));

    if (!firstName || !lastName || !dateOfBirth) {
      continue;
    }

    const id = safeProfileKey(lastName, firstName, dateOfBirth);
    const fullName = parsedName.fullName || `${firstName} ${lastName}`.trim();

    if (!map.has(id)) {
      map.set(id, {
        id,
        firstName,
        lastName,
        middleName: parsedName.middleName,
        suffix: parsedName.suffix,
        fullName,
        originalFullName: parsedName.originalFullName || fullName,
        dateOfBirth,
        searchText: [
          fullName,
          parsedName.originalFullName,
          firstName,
          lastName,
          dateOfBirth,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        demographics: {},
        biography: {},
        items: [],
        purchases: [],
        rentals: [],
        rows: [],
        sourceReportIds: [],
      });
    }

    const profile = map.get(id)!;

    profile.rows.push(row);

    if (!profile.sourceReportIds.includes(row.sourceReportId)) {
      profile.sourceReportIds.push(row.sourceReportId);
    }

    const cleaned = compactRowData(row.data);
    const category = inferCategory(row);

    if (category === "demographics") {
      profile.demographics = mergeFlatObjects(
        profile.demographics,
        {
          ...pickFields(cleaned, DEMOGRAPHIC_KEYS),
          first_name: firstName,
          last_name: lastName,
          middle_name: parsedName.middleName || null,
          suffix: parsedName.suffix || null,
          full_name: fullName,
          original_full_name: parsedName.originalFullName || fullName,
          dob: dateOfBirth,
        }
      );
    } else if (category === "items") {
      profile.items.push(cleaned);
    } else if (category === "purchases") {
      profile.purchases.push(cleaned);
    } else if (category === "rentals") {
      profile.rentals.push(cleaned);
    } else {
      profile.biography = mergeFlatObjects(
        profile.biography,
        {
          ...cleaned,
          first_name: firstName,
          last_name: lastName,
          middle_name: parsedName.middleName || null,
          suffix: parsedName.suffix || null,
          full_name: fullName,
          original_full_name: parsedName.originalFullName || fullName,
          dob: dateOfBirth,
        }
      );
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const byLast = a.lastName.localeCompare(b.lastName);
    if (byLast !== 0) return byLast;

    const byFirst = a.firstName.localeCompare(b.firstName);
    if (byFirst !== 0) return byFirst;

    return a.dateOfBirth.localeCompare(b.dateOfBirth);
  });
}

export function filterPatientProfiles(
  profiles: PatientProfile[],
  search: string
): PatientProfile[] {
  const needle = search.trim().toLowerCase();

  if (!needle) return profiles;

  return profiles.filter((profile) => {
    if (profile.searchText.includes(needle)) return true;

    const demographicText = Object.values(profile.demographics)
      .map((value) => asCleanString(value))
      .join(" ")
      .toLowerCase();

    return demographicText.includes(needle);
  });
}