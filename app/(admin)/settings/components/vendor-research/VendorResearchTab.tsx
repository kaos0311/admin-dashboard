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
  Building2,
  ExternalLink,
  Globe2,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { badges, buttons, colors, forms, glass, tiles, typography } from "@/theme";

type VendorResearchSite = {
  id: string;
  name: string;
  url: string;
  category: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedByEmail?: string;
};

type VendorResearchDraft = Omit<
  VendorResearchSite,
  "id" | "createdAt" | "updatedAt" | "updatedByEmail"
>;

const EMPTY_DRAFT: VendorResearchDraft = {
  name: "",
  url: "",
  category: "Medical Supplies",
  notes: "",
};

const STARTER_SITES: VendorResearchDraft[] = [
  {
    name: "Medline",
    url: "https://www.medline.com/",
    category: "Medical Supplies",
    notes:
      "Large medical supplies distributor. Useful for product details, replacements, and category research.",
  },
  {
    name: "Philips Home Health eStore",
    url: "https://www.homehealth.estore.philips.com/",
    category: "CPAP / Sleep",
    notes:
      "Philips consumer/home health storefront for CPAP and respiratory equipment research.",
  },
  {
    name: "Invacare",
    url: "https://invacareamerica.com/",
    category: "Mobility / Beds",
    notes:
      "Wheelchairs, walkers, patient lifts, respiratory, and hospital bed references.",
  },
  {
    name: "Vive Health",
    url: "https://www.vivehealth.com/",
    category: "DME / Wellness",
    notes:
      "Consumer and facility DME items including mobility, bath safety, and compression.",
  },
  {
    name: "ResMed",
    url: "https://www.resmed.com/",
    category: "CPAP / Sleep / Oxygen",
    notes:
      "Primary source for CPAP, BiPAP, masks, AirSense/AirCurve references, and sleep product research.",
  },
];

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSite(id: string, data: Record<string, unknown>): VendorResearchSite {
  return {
    id,
    name: textValue(data.name),
    url: textValue(data.url),
    category: textValue(data.category),
    notes: textValue(data.notes),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    updatedByEmail: textValue(data.updatedByEmail),
  };
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
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

function buildJarvisFindings(records: VendorResearchSite[]) {
  const findings: Array<{
    id: string;
    tone: "danger" | "warning" | "info";
    text: string;
  }> = [];

  const httpRecords = records.filter((record) => !looksLikeUrl(record.url));
  if (httpRecords.length) {
    findings.push({
      id: "bad-url",
      tone: "warning",
      text: `${httpRecords.length} vendor record(s) have an invalid URL. Update to https:// before using Jarvis research links.`,
    });
  }

  const emptyNotes = records.filter((record) => !record.notes);
  if (emptyNotes.length) {
    findings.push({
      id: "empty-notes",
      tone: "info",
      text: `${emptyNotes.length} vendor record(s) have no notes. Add usage notes so Jarvis knows when to consult each source.`,
    });
  }

  const unnamed = records.filter((record) => !record.name);
  if (unnamed.length) {
    findings.push({
      id: "unnamed",
      tone: "warning",
      text: `${unnamed.length} vendor record(s) are missing a display name.`,
    });
  }

  if (!records.length) {
    findings.push({
      id: "empty-list",
      tone: "info",
      text: "Vendor research list is empty. Seed it with manufacturer and distributor sites Jarvis should consult.",
    });
  }

  return findings.slice(0, 6);
}

function findingBadge(tone: "danger" | "warning" | "info") {
  if (tone === "danger") return badges.danger;
  if (tone === "warning") return badges.warning;
  return badges.info;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function VendorResearchTab() {
  const [records, setRecords] = useState<VendorResearchSite[]>([]);
  const [draft, setDraft] = useState<VendorResearchDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const collectionRef = collection(db, "vendorResearchSites");
    const q = query(collectionRef, orderBy("name", "asc"), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapped = snapshot.docs.map((docSnap) =>
          normalizeSite(docSnap.id, docSnap.data())
        );
        setRecords(mapped);

        if (!loaded && !snapshot.size) {
          const seed = async () => {
            try {
              await Promise.all(
                STARTER_SITES.map((site) =>
                  addDoc(collectionRef, {
                    ...site,
                    url: normalizeUrl(site.url),
                    createdByUid: auth.currentUser?.uid ?? null,
                    createdByEmail: auth.currentUser?.email ?? null,
                    createdAt: serverTimestamp(),
                  })
                )
              );
            } catch (error) {
              console.error("VENDOR RESEARCH SEED ERROR:", error);
            }
          };

          void seed();
        }

        setLoaded(true);
      },
      (error) => {
        console.error("VENDOR RESEARCH SNAPSHOT ERROR:", error);
        toast.error("Unable to load vendor research sites.");
      }
    );

    return () => unsubscribe();
  }, [loaded]);

  const filteredRecords = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) return records;

    return records.filter((record) =>
      [record.name, record.url, record.category, record.notes]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [records, search]);

  const jarvisFindings = useMemo(() => buildJarvisFindings(records), [records]);

  function updateDraft(field: keyof VendorResearchDraft, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetDraft(nextDraft: VendorResearchDraft = EMPTY_DRAFT) {
    setDraft(nextDraft);
    setEditingId("");
  }

  function startCreate() {
    resetDraft(EMPTY_DRAFT);
  }

  function startEdit(record: VendorResearchSite) {
    setDraft({
      name: record.name,
      url: record.url,
      category: record.category,
      notes: record.notes,
    });
    setEditingId(record.id);
  }

  async function saveRecord() {
    const name = draft.name.trim();
    let url = draft.url.trim();

    if (!name) {
      toast.error("Add a display name first.");
      return;
    }

    if (!url) {
      toast.error("Add a URL first.");
      return;
    }

    url = normalizeUrl(url);

    setSaving(true);

    try {
      const payload = {
        name,
        url,
        category: draft.category.trim(),
        notes: draft.notes.trim(),
        updatedByUid: auth.currentUser?.uid ?? null,
        updatedByEmail: auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await setDoc(doc(db, "vendorResearchSites", editingId), payload, {
          merge: true,
        });
      } else {
        await addDoc(collection(db, "vendorResearchSites"), {
          ...payload,
          createdByUid: auth.currentUser?.uid ?? null,
          createdByEmail: auth.currentUser?.email ?? null,
          createdAt: serverTimestamp(),
        });
      }

      toast.success(editingId ? "Vendor site updated." : "Vendor site saved.");
      resetDraft();
    } catch (error) {
      console.error("VENDOR RESEARCH SAVE ERROR:", error);
      toast.error("Could not save vendor research site.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record: VendorResearchSite) {
    const confirmed = window.confirm(`Remove ${record.name} from vendor research sites?`);
    if (!confirmed) return;

    setDeletingId(record.id);

    try {
      await deleteDoc(doc(db, "vendorResearchSites", record.id));
      toast.success("Vendor research site removed.");

      if (editingId === record.id) {
        resetDraft();
      }
    } catch (error) {
      console.error("VENDOR RESEARCH DELETE ERROR:", error);
      toast.error("Could not remove vendor research site.");
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
            void saveRecord();
          }}
        >
          <div className="flex items-start gap-3">
            <div className={glass.iconBox}>
              <Globe2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={typography.cardTitle}>
                {editingId ? "Edit Vendor Site" : "Vendor Research"}
              </p>
              <p className={`mt-1 ${typography.bodyMuted}`}>
                Document vendor or manufacturer sites Jarvis can consult for
                product research, pricing checks, replacement lookups, and
                discontinued product verification.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={typography.formLabel}>Display Name</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="Medline"
              />
            </label>

            <label className="block">
              <span className={typography.formLabel}>Website URL</span>
              <input
                className={`${forms.input} mt-2`}
                value={draft.url}
                onChange={(event) => updateDraft("url", event.target.value)}
                placeholder="https://www.medline.com/"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Category</span>
            <input
              className={`${forms.input} mt-2`}
              value={draft.category}
              onChange={(event) => updateDraft("category", event.target.value)}
              placeholder="CPAP, Mobility, Supplies..."
            />
          </label>

          <label className="mt-3 block">
            <span className={typography.formLabel}>Notes</span>
            <textarea
              className={`${forms.textareaCompact} mt-2`}
              rows={3}
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="What Jarvis should use this source for, or anything humans should know."
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={buttons.primary}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? "Update Site" : "Save Site"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={startCreate}
              className={buttons.secondary}
            >
              <Plus className="h-4 w-4" />
              New
            </button>

            {editingId ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => resetDraft()}
                className={buttons.ghost}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-6">
            <p className={`${typography.caption} uppercase tracking-wider text-slate-400`}>
              Quick add starter sites
            </p>
            <p className={`${typography.smallMuted} mt-1`}>
              Preload the list with common vendor sources if the table is empty.
            </p>

            <div className="mt-3 grid gap-2">
              {STARTER_SITES.map((site) => (
                <div
                  key={site.name}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">
                      {site.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {site.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={buttons.compactSecondary}
                    onClick={() => {
                      setEditingId("");
                      setDraft({
                        name: site.name,
                        url: site.url,
                        category: site.category,
                        notes: site.notes,
                      });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        <section className="space-y-5">
          <div className={`${glass.card} p-4 sm:p-5`}>
            <div className="flex items-start gap-3">
              <div className={glass.iconBox}>
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className={typography.cardTitle}>Jarvis Research Watch</p>
                <p className={`mt-1 ${typography.bodyMuted}`}>
                  Flags invalid URLs, missing notes, or gaps that limit Jarvis
                  product research quality.
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
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
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
                  Jarvis sees no issues with the current vendor research list.
                </div>
              )}
            </div>
          </div>

          <div className={`${glass.card} p-4 sm:p-5`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className={typography.cardTitle}>Vendor Research Sites</p>
                <p className={typography.smallMuted}>
                  Keep this list current so Jarvis can draw from trusted
                  manufacturer and distributor pages.
                </p>
              </div>

              <label className="relative min-w-0 sm:w-72">
                <span className="sr-only">Search vendor research sites</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className={`${forms.input} pl-10`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search sites..."
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
                          <div className={`${glass.iconBox} h-8 w-8 rounded-xl`}>
                            <Building2 className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <p className={tiles.title}>{record.name}</p>
                          {record.category ? (
                            <span className={badges.neutral}>
                              {record.category}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          {record.url ? (
                            <a
                              href={record.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-200 transition hover:text-cyan-100"
                            >
                              <Globe2 className="h-3.5 w-3.5" />
                              {record.url}
                            </a>
                          ) : (
                            <span className={typography.bodyMuted}>
                              No URL provided
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {record.url ? (
                          <a
                            href={record.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttons.secondary}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => startEdit(record)}
                          className={buttons.secondary}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === record.id}
                          onClick={() => deleteRecord(record)}
                          className={buttons.danger}
                          title="Delete vendor site"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {record.notes ? (
                      <p className={`${typography.bodyMuted} mt-3 max-w-3xl`}>
                        {record.notes}
                      </p>
                    ) : null}

                    <p className={`${typography.smallMuted} mt-3`}>
                      {record.updatedByEmail
                        ? `Last updated by ${record.updatedByEmail}`
                        : "No updater recorded"}
                      {record.updatedAt
                        ? ` at ${formatTimestamp(record.updatedAt)}`
                        : ""}
                    </p>
                  </article>
                ))
              ) : (
                <div className={`${glass.inset} p-5 text-center`}>
                  <Building2 className="mx-auto h-6 w-6 text-cyan-200" />
                  <p className={`${typography.bodyStrong} mt-3`}>
                    No vendor research sites found.
                  </p>
                  <p className={`mt-1 ${typography.bodyMuted}`}>
                    Add manufacturer or distributor URLs Jarvis should consult.
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
