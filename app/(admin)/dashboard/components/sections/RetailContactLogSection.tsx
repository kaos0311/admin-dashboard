"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { BadgeDollarSign, Clock, Save, UserRoundCheck } from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { badges, buttons, forms, glass, tiles, typography } from "@/theme";

import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type RetailContactStatus =
  | "first_contact"
  | "follow_up"
  | "quote_discussed"
  | "sale_pending"
  | "sale_completed"
  | "not_interested";

type RetailContactRecord = {
  id: string;
  contactOwner: string;
  customerName: string;
  customerPhone: string;
  conversationAtIso: string;
  createdAtLabel: string;
  productInterest: string;
  commissionEligible: boolean;
  estimatedValue: number;
  status: RetailContactStatus;
  notes: string;
  createdByEmail: string;
};

type RetailContactDraft = {
  contactOwner: string;
  customerName: string;
  customerPhone: string;
  conversationAtIso: string;
  productInterest: string;
  commissionEligible: boolean;
  estimatedValue: string;
  status: RetailContactStatus;
  notes: string;
};

const CONTACT_OWNER_OPTIONS = ["Kelci", "Mary", "Frank", "Paul", "Other"];

const STATUS_LABELS: Record<RetailContactStatus, string> = {
  first_contact: "First Contact",
  follow_up: "Follow Up",
  quote_discussed: "Quote Discussed",
  sale_pending: "Sale Pending",
  sale_completed: "Sale Completed",
  not_interested: "Not Interested",
};

const EMPTY_DRAFT: RetailContactDraft = {
  contactOwner: "Kelci",
  customerName: "",
  customerPhone: "",
  conversationAtIso: "",
  productInterest: "",
  commissionEligible: true,
  estimatedValue: "",
  status: "first_contact",
  notes: "",
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function formatConversationDate(value: string) {
  if (!value) return "Date not entered";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function customerKey(record: RetailContactRecord) {
  const phone = record.customerPhone.replace(/\D/g, "");
  return `${record.customerName.toLowerCase()}-${phone}`;
}

function statusBadge(status: RetailContactStatus) {
  if (status === "sale_completed") return badges.active;
  if (status === "sale_pending" || status === "quote_discussed") {
    return badges.warning;
  }
  if (status === "not_interested") return badges.danger;
  return badges.info;
}

function normalizeStatus(value: unknown): RetailContactStatus {
  if (
    value === "follow_up" ||
    value === "quote_discussed" ||
    value === "sale_pending" ||
    value === "sale_completed" ||
    value === "not_interested"
  ) {
    return value;
  }

  return "first_contact";
}

function normalizeRecord(
  id: string,
  data: Record<string, unknown>
): RetailContactRecord {
  return {
    id,
    contactOwner: textValue(data.contactOwner),
    customerName: textValue(data.customerName),
    customerPhone: textValue(data.customerPhone),
    conversationAtIso: textValue(data.conversationAtIso),
    createdAtLabel: formatDateLabel(data.createdAt),
    productInterest: textValue(data.productInterest),
    commissionEligible: Boolean(data.commissionEligible),
    estimatedValue: numberValue(data.estimatedValue),
    status: normalizeStatus(data.status),
    notes: textValue(data.notes),
    createdByEmail: textValue(data.createdByEmail),
  };
}

export function RetailContactLogSection() {
  const [records, setRecords] = useState<RetailContactRecord[]>([]);
  const [draft, setDraft] = useState<RetailContactDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const contactsQuery = query(
      collection(db, "retailCustomerContacts"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      contactsQuery,
      (snapshot) => {
        setRecords(
          snapshot.docs.map((docSnap) =>
            normalizeRecord(docSnap.id, docSnap.data())
          )
        );
      },
      (error) => {
        console.error("RETAIL CONTACTS SNAPSHOT ERROR:", error);
        toast.error("Unable to load retail contact records.");
      }
    );

    return () => unsubscribe();
  }, []);

  const firstContactByCustomer = useMemo(() => {
    const map = new Map<string, RetailContactRecord>();

    for (const record of [...records].reverse()) {
      const key = customerKey(record);
      if (!map.has(key)) {
        map.set(key, record);
      }
    }

    return map;
  }, [records]);

  function updateDraft(
    field: keyof RetailContactDraft,
    value: string | boolean
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveContact() {
    const customerName = draft.customerName.trim();
    const productInterest = draft.productInterest.trim();
    const notes = draft.notes.trim();

    if (!customerName || !productInterest || !notes) {
      toast.error("Add the customer, item, and conversation notes first.");
      return;
    }

    setSaving(true);

    try {
      const estimatedValue = numberValue(draft.estimatedValue);

      const docRef = await addDoc(collection(db, "retailCustomerContacts"), {
        contactOwner: draft.contactOwner,
        customerName,
        customerPhone: draft.customerPhone.trim(),
        conversationAtIso: draft.conversationAtIso,
        productInterest,
        commissionEligible: draft.commissionEligible,
        estimatedValue,
        status: draft.status,
        notes,
        firstContactClaimedAt: serverTimestamp(),
        createdByUid: auth.currentUser?.uid ?? null,
        createdByEmail: auth.currentUser?.email ?? null,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "retail_customer_contact_logged",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: docRef.id,
        targetName: customerName,
        targetCollection: "retailCustomerContacts",
        details: {
          contactOwner: draft.contactOwner,
          commissionEligible: draft.commissionEligible,
          estimatedValue,
          status: draft.status,
        },
        createdAt: serverTimestamp(),
      });

      setDraft({
        ...EMPTY_DRAFT,
        contactOwner: draft.contactOwner,
      });
      toast.success("Retail contact logged.");
    } catch (error) {
      console.error("RETAIL CONTACT SAVE ERROR:", error);
      toast.error("Could not save the retail contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassPanel
      title="Retail First Contact & Commission Log"
      icon={<BadgeDollarSign className="h-5 w-5" />}
    >
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className={`${glass.inset} p-4`}>
          <div className="flex items-start gap-3">
            <UserRoundCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
            <div className="min-w-0">
              <p className={typography.bodyStrong}>Log a Customer Conversation</p>
              <p className={["mt-1", typography.bodyMuted].join(" ")}>
                Records who made contact, when the conversation happened, and
                what was discussed for commission and follow-up tracking.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={typography.formLabel}>Employee</span>
              <select
                className={`${forms.select} mt-2`}
                value={draft.contactOwner}
                onChange={(event) =>
                  updateDraft("contactOwner", event.target.value)
                }
              >
                {CONTACT_OWNER_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={typography.formLabel}>Conversation Date</span>
              <input
                className={`${forms.input} mt-2`}
                type="datetime-local"
                value={draft.conversationAtIso}
                onChange={(event) =>
                  updateDraft("conversationAtIso", event.target.value)
                }
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Customer Name</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.customerName}
                onChange={(event) =>
                  updateDraft("customerName", event.target.value)
                }
                placeholder="Customer name"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Phone</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.customerPhone}
                onChange={(event) =>
                  updateDraft("customerPhone", event.target.value)
                }
                placeholder="Optional phone"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Item / Purchase Interest</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.productInterest}
                onChange={(event) =>
                  updateDraft("productInterest", event.target.value)
                }
                placeholder="Lift chair, scooter, CPAP supplies..."
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Estimated Value</span>
              <input
                className={`${forms.input} mt-2`}
                inputMode="decimal"
                value={draft.estimatedValue}
                onChange={(event) =>
                  updateDraft("estimatedValue", event.target.value)
                }
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Status</span>
              <select
                className={`${forms.select} mt-2`}
                value={draft.status}
                onChange={(event) =>
                  updateDraft("status", event.target.value)
                }
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 pt-7">
              <input
                type="checkbox"
                checked={draft.commissionEligible}
                onChange={(event) =>
                  updateDraft("commissionEligible", event.target.checked)
                }
              />
              <span className={typography.bodyMuted}>Commission eligible</span>
            </label>
          </div>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Conversation Notes</span>
            <textarea
              className={`${forms.textareaCompact} mt-2`}
              rows={4}
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="What was said, customer needs, quote details, follow-up promises, and rapport notes"
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveContact()}
            className={[buttons.primary, "mt-4"].join(" ")}
          >
            <Save className="h-4 w-4" />
            Save Contact
          </button>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={typography.cardTitle}>Recent Retail Contacts</p>
              <p className={typography.smallMuted}>
                First-contact ownership is based on the earliest saved contact
                for the same customer and phone.
              </p>
            </div>
            <span className={tiles.badge}>{records.length} logged</span>
          </div>

          <div className="space-y-3">
            {records.length ? (
              records.slice(0, 10).map((record) => {
                const firstContact = firstContactByCustomer.get(customerKey(record));
                const isFirstContact = firstContact?.id === record.id;

                return (
                  <article key={record.id} className={`${glass.inset} p-4`}>
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className={tiles.title}>{record.customerName}</p>
                        <p className={tiles.helper}>
                          {record.productInterest}
                          {record.customerPhone ? ` · ${record.customerPhone}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            statusBadge(record.status),
                          ].join(" ")}
                        >
                          {STATUS_LABELS[record.status]}
                        </span>
                        {record.commissionEligible ? (
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-xs font-bold",
                              badges.active,
                            ].join(" ")}
                          >
                            Commission
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                      <div>
                        <p className={typography.caption}>Owner</p>
                        <p className={typography.bodyStrong}>
                          {record.contactOwner || "Unassigned"}
                        </p>
                      </div>
                      <div>
                        <p className={typography.caption}>Conversation</p>
                        <p className={typography.bodyStrong}>
                          {formatConversationDate(record.conversationAtIso)}
                        </p>
                      </div>
                      <div>
                        <p className={typography.caption}>Value</p>
                        <p className={typography.bodyStrong}>
                          ${record.estimatedValue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <p className={["mt-3", typography.bodyMuted].join(" ")}>
                      {record.notes}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                          isFirstContact ? badges.active : badges.info,
                        ].join(" ")}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {isFirstContact
                          ? "First contact claim"
                          : `First contact: ${firstContact?.contactOwner ?? "Unknown"}`}
                      </span>
                      <span className={typography.smallMuted}>
                        Logged {record.createdAtLabel || "just now"}
                      </span>
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState text="No retail customer contacts have been logged yet." />
            )}
          </div>
        </section>
      </div>
    </GlassPanel>
  );
}
