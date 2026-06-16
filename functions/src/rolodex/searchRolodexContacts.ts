import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const CONTACT_TYPES = new Set([
  "vendor",
  "hospice",
  "insurance",
  "facility",
  "physician",
  "patient_family",
  "service",
  "internal",
  "other",
]);

type SearchRolodexRequest = {
  search?: unknown;
  contactType?: unknown;
  importantOnly?: unknown;
  limit?: unknown;
};

type RolodexSearchContact = {
  id: string;
  name: string;
  organization: string;
  roleTitle: string;
  contactType: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  notes: string;
  important: boolean;
  followUpDate: string;
  createdAtLabel: string;
  updatedAtLabel: string;
};

function assertStaffOrAdmin(request: {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
}) {
  const role = request.auth?.token.role;

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (role !== "admin" && role !== "staff" && role !== "tank") {
    throw new HttpsError("permission-denied", "Staff access required.");
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalized(value: unknown): string {
  return text(value).toLowerCase();
}

function formatDateLabel(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  return "";
}

function normalizeContactType(value: unknown): string {
  const candidate = text(value);
  return CONTACT_TYPES.has(candidate) ? candidate : "other";
}

function toLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function toSearchTokens(value: unknown): string[] {
  return normalized(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function contactHaystack(data: Record<string, unknown>): string {
  return [
    data.name,
    data.organization,
    data.roleTitle,
    data.contactType,
    data.phone,
    data.alternatePhone,
    data.email,
    data.address,
    data.notes,
    data.npi,
    data.pecosStatus,
  ]
    .map(normalized)
    .join(" ");
}

function normalizeContact(
  id: string,
  data: Record<string, unknown>
): RolodexSearchContact {
  return {
    id,
    name: text(data.name),
    organization: text(data.organization),
    roleTitle: text(data.roleTitle),
    contactType: normalizeContactType(data.contactType),
    phone: text(data.phone),
    alternatePhone: text(data.alternatePhone),
    email: text(data.email),
    address: text(data.address),
    notes: text(data.notes),
    important: data.important === true,
    followUpDate: text(data.followUpDate),
    createdAtLabel: formatDateLabel(data.createdAt),
    updatedAtLabel: formatDateLabel(data.updatedAt),
  };
}

export const searchRolodexContacts = onCall<SearchRolodexRequest>(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    assertStaffOrAdmin(request);

    const criteria = request.data ?? {};
    const contactType = text(criteria.contactType);
    const importantOnly = criteria.importantOnly === true;
    const resultLimit = toLimit(criteria.limit);
    const tokens = toSearchTokens(criteria.search);

    if (contactType && !CONTACT_TYPES.has(contactType) && contactType !== "all") {
      throw new HttpsError("invalid-argument", "Invalid contact type.");
    }

    const snapshot = await db.collection("rolodexContacts").limit(2500).get();
    const matches: RolodexSearchContact[] = [];

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data() as Record<string, unknown>;
      const normalizedType = normalizeContactType(data.contactType);

      if (contactType && contactType !== "all" && normalizedType !== contactType) {
        continue;
      }

      if (importantOnly && data.important !== true) {
        continue;
      }

      const haystack = contactHaystack(data);

      if (tokens.length && !tokens.every((token) => haystack.includes(token))) {
        continue;
      }

      matches.push(normalizeContact(docSnapshot.id, data));
    }

    matches.sort((a, b) => {
      if (a.important !== b.important) return a.important ? -1 : 1;

      const aName = a.name || a.organization;
      const bName = b.name || b.organization;

      return aName.localeCompare(bName);
    });

    return {
      contacts: matches.slice(0, resultLimit),
      totalMatches: matches.length,
      limited: matches.length > resultLimit,
      criteria: {
        search: text(criteria.search),
        contactType: contactType || "all",
        importantOnly,
        limit: resultLimit,
      },
    };
  }
);
