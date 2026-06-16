"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  BookOpen,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { auth, db, functions } from "@/lib/firebase";
import { alerts, badges, buttons, colors, forms, glass, tiles, typography } from "@/theme";

type RolodexContactType =
  | "vendor"
  | "hospice"
  | "insurance"
  | "facility"
  | "physician"
  | "patient_family"
  | "service"
  | "internal"
  | "other";

type RolodexContact = {
  id: string;
  name: string;
  organization: string;
  roleTitle: string;
  contactType: RolodexContactType;
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

type RolodexDraft = Omit<
  RolodexContact,
  "createdAtLabel" | "id" | "updatedAtLabel"
>;

type SearchRolodexResponse = {
  contacts: RolodexContact[];
  totalMatches: number;
  limited: boolean;
};

const EMPTY_DRAFT: RolodexDraft = {
  name: "",
  organization: "",
  roleTitle: "",
  contactType: "vendor",
  phone: "",
  alternatePhone: "",
  email: "",
  address: "",
  notes: "",
  important: false,
  followUpDate: "",
};

const CONTACT_TYPE_LABELS: Record<RolodexContactType, string> = {
  vendor: "Vendor",
  hospice: "Hospice",
  insurance: "Insurance",
  facility: "Facility",
  physician: "Physician",
  patient_family: "Patient / Family",
  service: "Service",
  internal: "Internal",
  other: "Other",
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
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

function normalizeContactType(value: unknown): RolodexContactType {
  if (
    value === "hospice" ||
    value === "insurance" ||
    value === "facility" ||
    value === "physician" ||
    value === "patient_family" ||
    value === "service" ||
    value === "internal" ||
    value === "other"
  ) {
    return value;
  }

  return "vendor";
}

function normalizeContact(
  id: string,
  data: Record<string, unknown>
): RolodexContact {
  return {
    id,
    name: textValue(data.name),
    organization: textValue(data.organization),
    roleTitle: textValue(data.roleTitle),
    contactType: normalizeContactType(data.contactType),
    phone: textValue(data.phone),
    alternatePhone: textValue(data.alternatePhone),
    email: textValue(data.email),
    address: textValue(data.address),
    notes: textValue(data.notes),
    important: Boolean(data.important),
    followUpDate: textValue(data.followUpDate),
    createdAtLabel: formatDateLabel(data.createdAt),
    updatedAtLabel: formatDateLabel(data.updatedAt),
  };
}

function typeBadge(contactType: RolodexContactType) {
  if (contactType === "hospice") return `${tiles.badge} ${badges.active}`;
  if (contactType === "insurance") return `${tiles.badge} ${badges.info}`;
  if (contactType === "facility" || contactType === "physician") {
    return `${tiles.badge} ${badges.warning}`;
  }

  return `${tiles.badge} ${badges.neutral}`;
}

function draftFromContact(contact: RolodexContact): RolodexDraft {
  return {
    name: contact.name,
    organization: contact.organization,
    roleTitle: contact.roleTitle,
    contactType: contact.contactType,
    phone: contact.phone,
    alternatePhone: contact.alternatePhone,
    email: contact.email,
    address: contact.address,
    notes: contact.notes,
    important: contact.important,
    followUpDate: contact.followUpDate,
  };
}

export default function RolodexPage() {
  const { isAdmin, loading } = useAuthRole();
  const [contacts, setContacts] = useState<RolodexContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [totalMatches, setTotalMatches] = useState(0);
  const [limited, setLimited] = useState(false);
  const [draft, setDraft] = useState<RolodexDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | RolodexContactType>(
    "all"
  );

  const searchContacts = useCallback(async () => {
    setLoadingContacts(true);
    setContactsError("");

    try {
      const callable = httpsCallable<
        {
          search: string;
          contactType: "all" | RolodexContactType;
          limit: number;
        },
        SearchRolodexResponse
      >(functions, "searchRolodexContacts");

      const result = await callable({
        search,
        contactType: typeFilter,
        limit: 75,
      });

      setContacts(result.data.contacts.map((contact) => normalizeContact(contact.id, contact)));
      setTotalMatches(result.data.totalMatches);
      setLimited(result.data.limited);
    } catch (error) {
      console.error("ROLODEX SEARCH ERROR:", error);
      setContacts([]);
      setTotalMatches(0);
      setLimited(false);
      setContactsError("Unable to search Rolodex contacts.");
      toast.error("Unable to search Rolodex contacts.");
    } finally {
      setLoadingContacts(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    if (loading) return;
    void searchContacts();
    // Load a capped initial result set once; searches after that are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const stats = useMemo(() => {
    return {
      important: contacts.filter((contact) => contact.important).length,
      total: contacts.length,
      withFollowUp: contacts.filter((contact) => contact.followUpDate).length,
    };
  }, [contacts]);

  function updateDraft(field: keyof RolodexDraft, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setEditingId("");
  }

  async function saveContact() {
    const name = draft.name.trim();
    const organization = draft.organization.trim();

    if (!name && !organization) {
      toast.error("Add a contact name or organization first.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...draft,
        name,
        organization,
        roleTitle: draft.roleTitle.trim(),
        phone: draft.phone.trim(),
        alternatePhone: draft.alternatePhone.trim(),
        email: draft.email.trim(),
        address: draft.address.trim(),
        notes: draft.notes.trim(),
        updatedByUid: auth.currentUser?.uid ?? null,
        updatedByEmail: auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await setDoc(doc(db, "rolodexContacts", editingId), payload, {
          merge: true,
        });
      } else {
        await addDoc(collection(db, "rolodexContacts"), {
          ...payload,
          createdByUid: auth.currentUser?.uid ?? null,
          createdByEmail: auth.currentUser?.email ?? null,
          createdAt: serverTimestamp(),
        });
      }

      await addDoc(collection(db, "auditLogs"), {
        action: editingId ? "rolodex_contact_updated" : "rolodex_contact_added",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: editingId || name || organization,
        targetName: name || organization,
        targetCollection: "rolodexContacts",
        details: {
          contactType: draft.contactType,
          important: draft.important,
        },
        createdAt: serverTimestamp(),
      });

      toast.success(editingId ? "Rolodex contact updated." : "Rolodex contact added.");
      resetDraft();
      await searchContacts();
    } catch (error) {
      console.error("ROLODEX SAVE ERROR:", error);
      toast.error("Could not save Rolodex contact.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: RolodexContact) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Delete ${contact.name || contact.organization}?`
    );

    if (!confirmed) return;

    setDeletingId(contact.id);

    try {
      await deleteDoc(doc(db, "rolodexContacts", contact.id));

      await addDoc(collection(db, "auditLogs"), {
        action: "rolodex_contact_deleted",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: contact.id,
        targetName: contact.name || contact.organization,
        targetCollection: "rolodexContacts",
        createdAt: serverTimestamp(),
      });

      toast.success("Rolodex contact deleted.");
      await searchContacts();
    } catch (error) {
      console.error("ROLODEX DELETE ERROR:", error);
      toast.error("Could not delete Rolodex contact.");
    } finally {
      setDeletingId("");
    }
  }

  if (loading) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} aria-hidden="true" />
        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className={`${glass.panel} p-6`}>
            <div className={`flex items-center gap-3 ${typography.body}`}>
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Rolodex...
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} aria-hidden="true" />

      <div className={`${glass.shell} relative z-10`}>
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className={badges.neutral}>
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Digital Rolodex
              </div>

              <h1 className={`${typography.pageTitle} mt-4`}>
                Important Contacts
              </h1>

              <p className={`mt-3 max-w-3xl ${typography.body}`}>
                Keep vendor, hospice, insurance, facility, physician, service,
                and internal contacts in one searchable place for the whole shop.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className={`${glass.card} p-4`}>
                <p className={typography.caption}>Contacts</p>
                <p className={typography.metricCompact}>{stats.total}</p>
              </div>
              <div className={`${glass.card} p-4`}>
                <p className={typography.caption}>Priority</p>
                <p className={typography.metricCompact}>{stats.important}</p>
              </div>
              <div className={`${glass.card} p-4`}>
                <p className={typography.caption}>Follow-Ups</p>
                <p className={typography.metricCompact}>{stats.withFollowUp}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.25fr)]">
          <form
            className={`${glass.panel} p-5`}
            onSubmit={(event) => {
              event.preventDefault();
              void saveContact();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={typography.cardTitle}>
                  {editingId ? "Edit Contact" : "Add Contact"}
                </p>
                <p className={typography.smallMuted}>
                  Save the people and companies the shop needs to reach quickly.
                </p>
              </div>

              <span className={badges.info}>
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                Shared
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={typography.formLabel}>Name</span>
                <input
                  className={`${forms.input} mt-2`}
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  placeholder="Contact name"
                />
              </label>

              <label className="block">
                <span className={typography.formLabel}>Organization</span>
                <input
                  className={`${forms.input} mt-2`}
                  value={draft.organization}
                  onChange={(event) =>
                    updateDraft("organization", event.target.value)
                  }
                  placeholder="Company, hospice, facility..."
                />
              </label>

              <label className="block">
                <span className={typography.formLabel}>Type</span>
                <select
                  className={`${forms.select} mt-2`}
                  value={draft.contactType}
                  onChange={(event) =>
                    updateDraft(
                      "contactType",
                      event.target.value as RolodexContactType
                    )
                  }
                >
                  {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={typography.formLabel}>Role / Department</span>
                <input
                  className={`${forms.input} mt-2`}
                  value={draft.roleTitle}
                  onChange={(event) =>
                    updateDraft("roleTitle", event.target.value)
                  }
                  placeholder="Nurse, intake, rep, billing..."
                />
              </label>

              <label className="block">
                <span className={typography.formLabel}>Phone</span>
                <input
                  className={`${forms.input} mt-2`}
                  value={draft.phone}
                  onChange={(event) => updateDraft("phone", event.target.value)}
                  placeholder="Main phone"
                />
              </label>

              <label className="block">
                <span className={typography.formLabel}>Alternate Phone</span>
                <input
                  className={`${forms.input} mt-2`}
                  value={draft.alternatePhone}
                  onChange={(event) =>
                    updateDraft("alternatePhone", event.target.value)
                  }
                  placeholder="Cell, after-hours, fax..."
                />
              </label>

              <label className="block sm:col-span-2">
                <span className={typography.formLabel}>Email</span>
                <input
                  className={`${forms.input} mt-2`}
                  type="email"
                  value={draft.email}
                  onChange={(event) => updateDraft("email", event.target.value)}
                  placeholder="name@example.com"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className={typography.formLabel}>Address / Location</span>
                <input
                  className={`${forms.input} mt-2`}
                  value={draft.address}
                  onChange={(event) =>
                    updateDraft("address", event.target.value)
                  }
                  placeholder="Address, branch, facility, or service area"
                />
              </label>

              <label className="block">
                <span className={typography.formLabel}>Follow-Up Date</span>
                <input
                  className={`${forms.input} mt-2`}
                  type="date"
                  value={draft.followUpDate}
                  onChange={(event) =>
                    updateDraft("followUpDate", event.target.value)
                  }
                />
              </label>

              <label className="flex items-center gap-3 pt-7">
                <input
                  type="checkbox"
                  checked={draft.important}
                  onChange={(event) =>
                    updateDraft("important", event.target.checked)
                  }
                />
                <span className={typography.bodyMuted}>Mark as priority</span>
              </label>
            </div>

            <label className="mt-3 block">
              <span className={typography.formLabel}>Notes</span>
              <textarea
                className={`${forms.textareaCompact} mt-2`}
                rows={4}
                value={draft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
                placeholder="What they handle, best time to call, special instructions, contract notes, after-hours rules..."
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className={buttons.primary}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingId ? "Save Changes" : "Save Contact"}
              </button>

              {editingId ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetDraft}
                  className={buttons.secondary}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          <section
            className={`${glass.panel} p-5`}
            onSubmit={(event) => {
              event.preventDefault();
              void searchContacts();
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={typography.cardTitle}>Contact Directory</p>
                <p className={typography.smallMuted}>
                  Search by name, company, phone, email, type, location, notes,
                  NPI, or PECOS status.
                </p>
              </div>

              <form className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 sm:w-72">
                  <span className="sr-only">Search Rolodex contacts</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className={`${forms.input} pl-10`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search contacts..."
                  />
                </label>

                <select
                  className={forms.select}
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value as "all" | RolodexContactType
                    )
                  }
                >
                  <option value="all">All types</option>
                  {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={loadingContacts}
                  className={buttons.primary}
                >
                  {loadingContacts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Search
                </button>
              </form>
            </div>

            <div className={`mt-4 ${typography.smallMuted}`}>
              {loadingContacts
                ? "Searching Rolodex..."
                : contactsError
                  ? contactsError
                  : `${contacts.length.toLocaleString()} shown from ${totalMatches.toLocaleString()} match${
                      totalMatches === 1 ? "" : "es"
                    }${limited ? " - refine search to narrow results" : ""}.`}
            </div>

            <div className="mt-5 grid gap-4">
              {contacts.length ? (
                contacts.map((contact) => (
                  <article
                    key={contact.id}
                    className={`${tiles.base} ${tiles.operational}`}
                  >
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={tiles.title}>
                            {contact.name || contact.organization || "Unnamed contact"}
                          </p>

                          {contact.important ? (
                            <span className={`${tiles.badge} ${badges.warning}`}>
                              <Star className="h-3.5 w-3.5" aria-hidden="true" />
                              Priority
                            </span>
                          ) : null}

                          <span className={typeBadge(contact.contactType)}>
                            {CONTACT_TYPE_LABELS[contact.contactType]}
                          </span>
                        </div>

                        <p className={`${tiles.helper} mt-1`}>
                          {[contact.organization, contact.roleTitle]
                            .filter(Boolean)
                            .join(" - ") || "No organization entered"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(draftFromContact(contact));
                            setEditingId(contact.id);
                          }}
                          className={buttons.secondary}
                        >
                          Edit
                        </button>

                        {isAdmin ? (
                          <button
                            type="button"
                            disabled={deletingId === contact.id}
                            onClick={() => void deleteContact(contact)}
                            className={buttons.danger}
                            title="Delete contact"
                          >
                            {deletingId === contact.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className={glass.listItem}>
                        <p className={typography.caption}>Phone</p>
                        <p className={typography.bodyStrong}>
                          <Phone className="mr-1 inline h-3.5 w-3.5" />
                          {contact.phone || "Not entered"}
                        </p>
                        {contact.alternatePhone ? (
                          <p className={typography.smallMuted}>
                            Alt: {contact.alternatePhone}
                          </p>
                        ) : null}
                      </div>

                      <div className={glass.listItem}>
                        <p className={typography.caption}>Email</p>
                        <p className={`break-words ${typography.bodyStrong}`}>
                          <Mail className="mr-1 inline h-3.5 w-3.5" />
                          {contact.email || "Not entered"}
                        </p>
                      </div>

                      <div className={glass.listItem}>
                        <p className={typography.caption}>Follow-Up</p>
                        <p className={typography.bodyStrong}>
                          {contact.followUpDate || "None"}
                        </p>
                      </div>
                    </div>

                    {contact.address ? (
                      <p className={`mt-3 ${typography.bodyMuted}`}>
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        {contact.address}
                      </p>
                    ) : null}

                    {contact.notes ? (
                      <p className={`mt-3 ${typography.bodyMuted}`}>
                        {contact.notes}
                      </p>
                    ) : null}

                    <p className={`mt-3 ${typography.smallMuted}`}>
                      {contact.updatedAtLabel
                        ? `Updated ${contact.updatedAtLabel}`
                        : contact.createdAtLabel
                          ? `Created ${contact.createdAtLabel}`
                          : "Timestamp pending"}
                    </p>
                  </article>
                ))
              ) : (
                <div className={alerts.info}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  No Rolodex contacts match the current search.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
