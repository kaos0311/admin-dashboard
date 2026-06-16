"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  Code2,
  ExternalLink,
  KeyRound,
  Lightbulb,
  Loader2,
  PlugZap,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { badges, buttons, colors, forms, glass, tiles, typography } from "@/theme";

type ApiStatus = "in_use" | "available" | "testing" | "paused";

type ApiRegistryRecord = {
  id: string;
  name: string;
  provider: string;
  status: ApiStatus;
  category: string;
  purpose: string;
  docsUrl: string;
  baseUrl: string;
  keyLocation: string;
  notes: string;
  sampleCode: string;
  updatedAtMs: number;
  updatedAtLabel: string;
};

type ApiDraft = Omit<ApiRegistryRecord, "id" | "updatedAtLabel" | "updatedAtMs">;

const EMPTY_DRAFT: ApiDraft = {
  name: "",
  provider: "",
  status: "available",
  category: "Search",
  purpose: "",
  docsUrl: "",
  baseUrl: "",
  keyLocation: "",
  notes: "",
  sampleCode: "",
};

const SERPAPI_STARTER: ApiDraft = {
  name: "SerpApi - Web Search API",
  provider: "SerpApi",
  status: "available",
  category: "Search",
  purpose:
    "Available web search provider for pulling outside business, product, or research data when approved.",
  docsUrl: "https://serpapi.com/",
  baseUrl: "https://serpapi.com/",
  keyLocation: "Store API key in Firebase Functions config or environment variables, not Firestore.",
  notes:
    "Starter record based on provided fetch example. Add the actual endpoint/query parameters once the account plan and key handling are confirmed.",
  sampleCode: `const response = await fetch("https://serpapi.com/", {
  method: "GET",
  headers: {
    "Content-Type": "application/json"
  }
});

const data = await response.json();
console.log(data);`,
};

const STATUS_LABELS: Record<ApiStatus, string> = {
  in_use: "In Use",
  available: "Available",
  testing: "Testing",
  paused: "Paused",
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): ApiStatus {
  if (value === "in_use" || value === "testing" || value === "paused") {
    return value;
  }

  return "available";
}

function formatTimestamp(value: unknown): string {
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

function normalizeApiRecord(
  id: string,
  data: Record<string, unknown>
): ApiRegistryRecord {
  return {
    id,
    name: textValue(data.name),
    provider: textValue(data.provider),
    status: normalizeStatus(data.status),
    category: textValue(data.category),
    purpose: textValue(data.purpose),
    docsUrl: textValue(data.docsUrl),
    baseUrl: textValue(data.baseUrl),
    keyLocation: textValue(data.keyLocation),
    notes: textValue(data.notes),
    sampleCode: textValue(data.sampleCode),
    updatedAtMs:
      data.updatedAt &&
      typeof data.updatedAt === "object" &&
      "toDate" in data.updatedAt &&
      typeof (data.updatedAt as { toDate?: unknown }).toDate === "function"
        ? (data.updatedAt as { toDate: () => Date }).toDate().getTime()
        : 0,
    updatedAtLabel: formatTimestamp(data.updatedAt),
  };
}

function statusBadge(status: ApiStatus) {
  if (status === "in_use") return badges.active;
  if (status === "testing") return badges.warning;
  if (status === "paused") return badges.neutral;
  return badges.info;
}

function draftFromRecord(record: ApiRegistryRecord): ApiDraft {
  return {
    name: record.name,
    provider: record.provider,
    status: record.status,
    category: record.category,
    purpose: record.purpose,
    docsUrl: record.docsUrl,
    baseUrl: record.baseUrl,
    keyLocation: record.keyLocation,
    notes: record.notes,
    sampleCode: record.sampleCode,
  };
}

function hasPossibleSecret(record: ApiRegistryRecord) {
  const combined = [
    record.sampleCode,
    record.notes,
    record.keyLocation,
  ].join("\n");

  return /(api[_-]?key|secret|token|bearer|sk_live|AIza)[\s:=]+[A-Za-z0-9_\-.]{10,}/i.test(
    combined
  );
}

function buildJarvisApiFindings(records: ApiRegistryRecord[]) {
  const findings: Array<{
    id: string;
    tone: "danger" | "warning" | "info";
    text: string;
  }> = [];

  const now = Date.now();
  const staleReviewMs = 1000 * 60 * 60 * 24 * 90;

  for (const record of records) {
    if (hasPossibleSecret(record)) {
      findings.push({
        id: `${record.id}-secret`,
        tone: "danger",
        text: `${record.name} may contain a pasted key, token, or secret. Move secrets to environment storage and redact the record.`,
      });
    }

    if (record.status === "in_use" && !record.keyLocation) {
      findings.push({
        id: `${record.id}-key-location`,
        tone: "warning",
        text: `${record.name} is marked in use but does not document where the key is stored.`,
      });
    }

    if (!record.docsUrl) {
      findings.push({
        id: `${record.id}-docs`,
        tone: "warning",
        text: `${record.name} is missing a documentation link for later review.`,
      });
    }

    if (record.updatedAtMs > 0 && now - record.updatedAtMs > staleReviewMs) {
      findings.push({
        id: `${record.id}-stale`,
        tone: "info",
        text: `${record.name} has not been reviewed in more than 90 days.`,
      });
    }
  }

  if (!records.some((record) => /map|route|geocode/i.test(record.category))) {
    findings.push({
      id: "recommend-maps",
      tone: "info",
      text: "Recommended future category: maps/geocoding API for delivery routing, ETA checks, and address cleanup.",
    });
  }

  if (!records.some((record) => /ocr|document|pdf/i.test(record.category))) {
    findings.push({
      id: "recommend-ocr",
      tone: "info",
      text: "Recommended future category: OCR/document API for delivery tickets, PDFs, and chart indexing.",
    });
  }

  if (!records.some((record) => /sms|phone|message/i.test(record.category))) {
    findings.push({
      id: "recommend-messaging",
      tone: "info",
      text: "Recommended future category: SMS/voice API for appointment reminders and delivery status updates.",
    });
  }

  return findings.slice(0, 8);
}

function findingBadge(tone: "danger" | "warning" | "info") {
  if (tone === "danger") return badges.danger;
  if (tone === "warning") return badges.warning;
  return badges.info;
}

export function ApiRegistryTab() {
  const [records, setRecords] = useState<ApiRegistryRecord[]>([]);
  const [draft, setDraft] = useState<ApiDraft>(SERPAPI_STARTER);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const apiQuery = query(
      collection(db, "apiRegistry"),
      orderBy("name", "asc"),
      limit(150)
    );

    const unsubscribe = onSnapshot(
      apiQuery,
      (snapshot) => {
        setRecords(
          snapshot.docs.map((docSnap) =>
            normalizeApiRecord(docSnap.id, docSnap.data())
          )
        );
      },
      (error) => {
        console.error("API REGISTRY SNAPSHOT ERROR:", error);
        toast.error("Unable to load API registry.");
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredRecords = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) return records;

    return records.filter((record) =>
      [
        record.name,
        record.provider,
        record.status,
        record.category,
        record.purpose,
        record.baseUrl,
        record.docsUrl,
        record.keyLocation,
        record.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [records, search]);

  const jarvisFindings = useMemo(() => {
    return buildJarvisApiFindings(records);
  }, [records]);

  function updateDraft(field: keyof ApiDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetDraft(nextDraft: ApiDraft = EMPTY_DRAFT) {
    setDraft(nextDraft);
    setEditingId("");
  }

  async function saveApiRecord() {
    const name = draft.name.trim();
    const provider = draft.provider.trim();

    if (!name || !provider) {
      toast.error("Add the API name and provider first.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...draft,
        name,
        provider,
        category: draft.category.trim(),
        purpose: draft.purpose.trim(),
        docsUrl: draft.docsUrl.trim(),
        baseUrl: draft.baseUrl.trim(),
        keyLocation: draft.keyLocation.trim(),
        notes: draft.notes.trim(),
        sampleCode: draft.sampleCode.trim(),
        updatedByUid: auth.currentUser?.uid ?? null,
        updatedByEmail: auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await setDoc(doc(db, "apiRegistry", editingId), payload, {
          merge: true,
        });
      } else {
        await addDoc(collection(db, "apiRegistry"), {
          ...payload,
          createdByUid: auth.currentUser?.uid ?? null,
          createdByEmail: auth.currentUser?.email ?? null,
          createdAt: serverTimestamp(),
        });
      }

      await addDoc(collection(db, "auditLogs"), {
        action: editingId ? "api_registry_updated" : "api_registry_added",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: editingId || name,
        targetName: name,
        targetCollection: "apiRegistry",
        details: {
          provider,
          status: draft.status,
          category: draft.category,
        },
        createdAt: serverTimestamp(),
      });

      toast.success(editingId ? "API record updated." : "API record saved.");
      resetDraft();
    } catch (error) {
      console.error("API REGISTRY SAVE ERROR:", error);
      toast.error("Could not save API record.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteApiRecord(record: ApiRegistryRecord) {
    const confirmed = window.confirm(`Delete API record for ${record.name}?`);
    if (!confirmed) return;

    setDeletingId(record.id);

    try {
      await deleteDoc(doc(db, "apiRegistry", record.id));

      await addDoc(collection(db, "auditLogs"), {
        action: "api_registry_deleted",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        targetId: record.id,
        targetName: record.name,
        targetCollection: "apiRegistry",
        createdAt: serverTimestamp(),
      });

      toast.success("API record deleted.");
    } catch (error) {
      console.error("API REGISTRY DELETE ERROR:", error);
      toast.error("Could not delete API record.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className={glass.panel}>
      <div className={colors.grid} />

      <div className="relative grid gap-6 p-5 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
        <form
          className={`${glass.card} p-4 sm:p-5`}
          onSubmit={(event) => {
            event.preventDefault();
            void saveApiRecord();
          }}
        >
          <div className="flex items-start gap-3">
            <div className={glass.iconBox}>
              <PlugZap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={typography.cardTitle}>
                {editingId ? "Edit API" : "API Registry"}
              </p>
              <p className={`mt-1 ${typography.bodyMuted}`}>
                Track APIs in use and APIs available for later without storing
                secret keys in Firestore.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={typography.formLabel}>API Name</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="SerpApi - Web Search API"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Provider</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.provider}
                onChange={(event) => updateDraft("provider", event.target.value)}
                placeholder="SerpApi"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Status</span>
              <select
                className={`${forms.select} mt-2`}
                value={draft.status}
                onChange={(event) => updateDraft("status", event.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={typography.formLabel}>Category</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.category}
                onChange={(event) => updateDraft("category", event.target.value)}
                placeholder="Search, Maps, OCR, Billing..."
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Purpose</span>
            <textarea
              className={`${forms.textareaCompact} mt-2`}
              rows={3}
              value={draft.purpose}
              onChange={(event) => updateDraft("purpose", event.target.value)}
              placeholder="What this API is used for or could be used for"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={typography.formLabel}>Base URL</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.baseUrl}
                onChange={(event) => updateDraft("baseUrl", event.target.value)}
                placeholder="https://serpapi.com/"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Docs URL</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.docsUrl}
                onChange={(event) => updateDraft("docsUrl", event.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Key Location</span>
            <input
              className={`${forms.input} mt-2`}
              value={draft.keyLocation}
              onChange={(event) => updateDraft("keyLocation", event.target.value)}
              placeholder="Example: Firebase Functions env var SERPAPI_KEY"
            />
          </label>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Notes</span>
            <textarea
              className={`${forms.textareaCompact} mt-2`}
              rows={3}
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="Plan, limits, approval notes, risks, next steps"
            />
          </label>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Sample Code / Usage</span>
            <textarea
              className={`${forms.textareaCompact} mt-2 font-mono text-xs`}
              rows={7}
              value={draft.sampleCode}
              onChange={(event) => updateDraft("sampleCode", event.target.value)}
              placeholder="Paste a safe example or usage notes"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={buttons.primary}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save API
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => resetDraft(SERPAPI_STARTER)}
              className={buttons.secondary}
            >
              <Code2 className="h-4 w-4" />
              SerpApi Starter
            </button>

            {editingId ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => resetDraft()}
                className={buttons.ghost}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="space-y-5">
          <div className={`${glass.card} p-4 sm:p-5`}>
            <div className="flex items-start gap-3">
              <div className={glass.iconBox}>
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className={typography.cardTitle}>Jarvis API Watch</p>
                <p className={`mt-1 ${typography.bodyMuted}`}>
                  Flags API records that need security review, documentation,
                  key-handling notes, or future growth consideration.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {jarvisFindings.length ? (
                jarvisFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className={`${glass.inset} flex items-start gap-3 p-3`}
                  >
                    {finding.tone === "info" ? (
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                    )}

                    <div className="min-w-0">
                      <span className={findingBadge(finding.tone)}>
                        {finding.tone === "danger"
                          ? "Security"
                          : finding.tone === "warning"
                            ? "Review"
                            : "Recommendation"}
                      </span>

                      <p className={`${typography.bodyMuted} mt-2`}>
                        {finding.text}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${glass.inset} p-4 ${typography.bodyMuted}`}>
                  Jarvis sees no obvious API registry issues in the current
                  records.
                </div>
              )}
            </div>
          </div>

          <div className={`${glass.card} p-4 sm:p-5`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className={typography.cardTitle}>Known APIs</p>
              <p className={typography.smallMuted}>
                Keep this as a living list of tools the database can use.
              </p>
            </div>

            <label className="relative min-w-0 sm:w-72">
              <span className="sr-only">Search API registry</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className={`${forms.input} pl-10`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search APIs..."
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4">
            {filteredRecords.length ? (
              filteredRecords.map((record) => (
                <article key={record.id} className={`${tiles.operational} p-4`}>
                  <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={tiles.title}>{record.name}</p>
                        <span className={statusBadge(record.status)}>
                          {STATUS_LABELS[record.status]}
                        </span>
                        {record.category ? (
                          <span className={badges.neutral}>{record.category}</span>
                        ) : null}
                      </div>

                      <p className={`${tiles.helper} mt-1`}>
                        {record.provider || "Unknown provider"}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(draftFromRecord(record));
                          setEditingId(record.id);
                        }}
                        className={buttons.secondary}
                      >
                        Edit
                      </button>

                      {record.docsUrl ? (
                        <a
                          href={record.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttons.secondary}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Docs
                        </a>
                      ) : null}

                      <button
                        type="button"
                        disabled={deletingId === record.id}
                        onClick={() => void deleteApiRecord(record)}
                        className={buttons.danger}
                        title="Delete API record"
                      >
                        {deletingId === record.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {record.purpose ? (
                    <p className={`${typography.bodyMuted} mt-3`}>
                      {record.purpose}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className={`${glass.inset} p-3`}>
                      <p className={typography.caption}>Base URL</p>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-100">
                        {record.baseUrl || "Not entered"}
                      </p>
                    </div>

                    <div className={`${glass.inset} p-3`}>
                      <p className={typography.caption}>Key Handling</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        <KeyRound className="mr-1 inline h-3.5 w-3.5" />
                        {record.keyLocation || "Do not store keys here"}
                      </p>
                    </div>
                  </div>

                  {record.notes ? (
                    <p className={`${typography.smallMuted} mt-3`}>
                      {record.notes}
                    </p>
                  ) : null}

                  {record.sampleCode ? (
                    <pre className="mt-3 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-slate-200">
                      {record.sampleCode}
                    </pre>
                  ) : null}
                </article>
              ))
            ) : (
              <div className={`${glass.inset} p-5 text-center`}>
                <PlugZap className="mx-auto h-6 w-6 text-cyan-200" />
                <p className={`${typography.bodyStrong} mt-3`}>
                  No API records match the current search.
                </p>
              </div>
            )}
          </div>
          </div>
        </section>
      </div>
    </section>
  );
}
