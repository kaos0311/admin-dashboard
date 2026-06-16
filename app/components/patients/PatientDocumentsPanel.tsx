"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import {
  Download,
  ExternalLink,
  FileText,
  HeartPulse,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import toast from "react-hot-toast";

import { alerts, buttons, colors, forms, glass, spacing, typography } from "@/theme";
import { db, storage } from "@/lib/firebase";

type PatientDocument = {
  id: string;
  fileName: string;
  originalFileName: string;
  storagePath: string;
  downloadURL: string;
  contentType: string;
  fileSize: number;
  documentType: string;
  notes: string;
  uploadedAtLabel: string;
  uploadedBy?: string;
};

type PatientSummary = {
  isHospice: boolean;
  hospiceProvider: string;
  insurance: string;
};

const DOCUMENT_TYPE_OPTIONS = [
  "Delivery Ticket",
  "Pickup Ticket",
  "Signed Delivery Ticket",
  "Signed Pickup Ticket",
  "Physician Order",
  "CMN",
  "wip",
  "Prescription",
  "Insurance Document",
  "Face Sheet",
  "Authorization",
  "Progress Notes",
  "Other",
] as const;

const MAX_UPLOAD_MB = 25;

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function lower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function detectHospicePatient(data: Record<string, unknown>): PatientSummary {
  const insurance = normalizeString(
    data.insurance ??
      data.primaryInsurance ??
      data.payor ??
      data.payer ??
      data.insuranceName
  );

  const hospiceProvider = normalizeString(
    data.hospiceProvider ??
      data.hospiceAgency ??
      data.facilityName ??
      data.providerName
  );

  const combined = [
    data.isHospice,
    data.hospice,
    data.patientType,
    data.category,
    data.reportType,
    data.sourceReportType,
    data.notes,
    insurance,
    hospiceProvider,
  ]
    .map((value) => lower(value))
    .join(" ");

  return {
    isHospice:
      data.isHospice === true ||
      data.hospice === true ||
      combined.includes("hospice"),
    hospiceProvider,
    insurance,
  };
}

function formatDateLabel(value: unknown): string {
  if (!value) return "—";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString();
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, "_");
}

export default function PatientDocumentsPanel({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);

  const [patientSummary, setPatientSummary] = useState<PatientSummary>({
    isHospice: false,
    hospiceProvider: "",
    insurance: "",
  });

  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("Delivery Ticket");
  const [notes, setNotes] = useState("");

  const uploadLockRef = useRef(false);

  useEffect(() => {
    if (!patientId) return;

    const unsub = onSnapshot(
      doc(db, "patients", patientId),
      (snapshot) => {
        const data = snapshot.exists()
          ? (snapshot.data() as Record<string, unknown>)
          : {};

        setPatientSummary(detectHospicePatient(data));
        setLoadingPatient(false);
      },
      (error) => {
        console.error(
          "PATIENT LOAD ERROR:",
          error instanceof Error ? error.message : error
        );

        setLoadingPatient(false);
      }
    );

    return () => unsub();
  }, [patientId]);

  useEffect(() => {
    if (!patientId || patientSummary.isHospice) {
      setLoadingDocuments(false);
      return;
    }

    const q = query(
      collection(db, "patients", patientId, "documents"),
      orderBy("uploadedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs: PatientDocument[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;

          return {
            id: docSnap.id,
            fileName: normalizeString(data.fileName),
            originalFileName: normalizeString(data.originalFileName),
            storagePath: normalizeString(data.storagePath),
            downloadURL: normalizeString(data.downloadURL),
            contentType: normalizeString(data.contentType),
            fileSize: Number(data.fileSize) || 0,
            documentType: normalizeString(data.documentType),
            notes: normalizeString(data.notes),
            uploadedBy: normalizeString(data.uploadedBy),
            uploadedAtLabel: formatDateLabel(data.uploadedAt),
          };
        });

        setDocuments(docs);
        setLoadingDocuments(false);
      },
      (error) => {
        console.error(
          "DOCUMENT LIST ERROR:",
          error instanceof Error ? error.message : error
        );

        toast.error("Failed to load patient documents.");
        setLoadingDocuments(false);
      }
    );

    return () => unsub();
  }, [patientId, patientSummary.isHospice]);

  const totalStorageUsed = useMemo(() => {
    return documents.reduce((sum, docItem) => sum + docItem.fileSize, 0);
  }, [documents]);

  async function handleUpload() {
    if (uploadLockRef.current) return;

    if (!selectedFile) {
      toast.error("Select a PDF first.");
      return;
    }

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Only PDF uploads are allowed.");
      return;
    }

    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;

    if (selectedFile.size > maxBytes) {
      toast.error(`PDF exceeds ${MAX_UPLOAD_MB}MB upload limit.`);
      return;
    }

    uploadLockRef.current = true;
    setUploading(true);

    try {
      const documentRef = doc(collection(db, "patients", patientId, "documents"));
      const safeName = sanitizeFileName(selectedFile.name);
      const path = `patient-documents/${patientId}/${documentRef.id}/${Date.now()}-${safeName}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, selectedFile);

      const url = await getDownloadURL(storageRef);

      await setDoc(documentRef, {
        patientId,
        patientName,
        fileName: safeName,
        originalFileName: selectedFile.name,
        storagePath: path,
        downloadURL: url,
        contentType: selectedFile.type,
        fileSize: selectedFile.size,
        documentType,
        notes,
        uploadedAt: serverTimestamp(),
      });

      toast.success("PDF uploaded.");

      setSelectedFile(null);
      setNotes("");
    } catch (err) {
      console.error(
        "UPLOAD ERROR:",
        err instanceof Error ? err.message : err
      );

      toast.error("Upload failed.");
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
    }
  }

  async function handleDelete(documentItem: PatientDocument) {
    const confirmed = window.confirm(
      `Delete "${documentItem.originalFileName}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(documentItem.id);

      if (documentItem.storagePath) {
        const storageRef = ref(storage, documentItem.storagePath);
        await deleteObject(storageRef);
      }

      await deleteDoc(
        doc(
          db,
          "patients",
          patientId,
          "documents",
          documentItem.id
        )
      );

      toast.success("Document deleted.");
    } catch (err) {
      console.error(
        "DELETE ERROR:",
        err instanceof Error ? err.message : err
      );

      toast.error("Failed to delete document.");
    } finally {
      setDeletingId("");
    }
  }

  if (loadingPatient) {
    return (
      <div className={[glass.cardPadded, spacing.cardLg].join(" ")}>
        <div className={[spacing.inlineMd, typography.bodyMuted].join(" ")}>
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading patient information...
        </div>
      </div>
    );
  }

  if (patientSummary.isHospice) {
    return (
      <div className={alerts.danger}>
        <div className="flex items-start gap-4">
          <div className={[glass.iconBox, colors.dangerBadge].join(" ")}>
            <HeartPulse className="h-6 w-6" />
          </div>

          <div>
            <h3 className={typography.cardTitle}>
              Hospice Patient Detected
            </h3>

            <p className={["mt-2", typography.body].join(" ")}>
              Uploads are disabled for hospice patients from this panel.
            </p>

            {patientSummary.hospiceProvider ? (
              <div className={["mt-4", typography.bodyStrong].join(" ")}>
                Hospice Provider:
                <span className="ml-2 font-medium">
                  {patientSummary.hospiceProvider}
                </span>
              </div>
            ) : null}

            {patientSummary.insurance ? (
              <div className={["mt-2", typography.bodyStrong].join(" ")}>
                Insurance:
                <span className="ml-2 font-medium">
                  {patientSummary.insurance}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={spacing.stack}>
      <section className={[glass.cardPadded, spacing.section].join(" ")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className={typography.cardTitle}>
              Patient Documents
            </h3>

            <p className={["mt-1", typography.bodyMuted].join(" ")}>
              Upload signed tickets, CMNs, PARs, physician orders,
              and insurance documentation.
            </p>
          </div>

          <div className={[glass.insetPadded, "px-4 py-3"].join(" ")}>
            <div className={typography.smallMuted}>
              Total Documents
            </div>

            <div className={["mt-1", typography.bodyStrong].join(" ")}>
              {documents.length}
            </div>

            <div className={["mt-2", typography.smallMuted].join(" ")}>
              Storage Used: {formatFileSize(totalStorageUsed)}
            </div>
          </div>
        </div>

        <div className={["mt-6", spacing.gridTwo].join(" ")}>
          <div className={forms.field}>
            <label
              htmlFor="doc-type"
              className={forms.label}
            >
              Document Type
            </label>

            <select
              id="doc-type"
              title="Document Type"
              aria-label="Document Type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className={forms.select}
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className={forms.field}>
            <label
              htmlFor="doc-file"
              className={forms.label}
            >
              PDF File
            </label>

            <input
              id="doc-file"
              title="PDF File"
              aria-label="PDF File"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) =>
                setSelectedFile(e.target.files?.[0] ?? null)
              }
              className={forms.input}
            />

            <div className={["mt-2", forms.helper].join(" ")}>
              PDF only · Max {MAX_UPLOAD_MB}MB
            </div>
          </div>
        </div>

        <div className={["mt-4", forms.field].join(" ")}>
          <label
            htmlFor="doc-notes"
            className={forms.label}
          >
            Internal Notes
          </label>

          <textarea
            id="doc-notes"
            title="Internal Notes"
            aria-label="Internal Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this upload..."
            className={forms.textareaCompact}
          />
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className={["mt-5", buttons.primary].join(" ")}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload PDF
            </>
          )}
        </button>
      </section>

      <section className={[glass.cardPadded, spacing.section].join(" ")}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className={typography.cardTitle}>
              Uploaded Documents
            </h3>

            <p className={["mt-1", typography.bodyMuted].join(" ")}>
              Secure patient document archive.
            </p>
          </div>
        </div>

        {loadingDocuments ? (
          <div className={["mt-6", spacing.inlineMd, typography.bodyMuted].join(" ")}>
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className={["mt-6", glass.emptyState].join(" ")}>
            No patient documents uploaded yet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {documents.map((documentItem) => {
              const deleting = deletingId === documentItem.id;

              return (
                <article
                  key={documentItem.id}
                  className={glass.listItem}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className={spacing.inlineMd}>
                        <div className={glass.iconBoxSm}>
                          <FileText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div className={["truncate", typography.bodyStrong].join(" ")}>
                            {documentItem.originalFileName}
                          </div>

                          <div className={["mt-1", typography.smallMuted].join(" ")}>
                            {documentItem.documentType}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                        <InfoRow
                          label="Uploaded"
                          value={documentItem.uploadedAtLabel}
                        />

                        <InfoRow
                          label="File Size"
                          value={formatFileSize(documentItem.fileSize)}
                        />

                        <InfoRow
                          label="Content Type"
                          value={documentItem.contentType}
                        />

                        <InfoRow
                          label="Storage Path"
                          value={documentItem.storagePath}
                        />
                      </div>

                      {documentItem.notes ? (
                        <div className={["mt-4", glass.insetPadded, typography.body].join(" ")}>
                          {documentItem.notes}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link
                        href={documentItem.downloadURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttons.secondary}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </Link>

                      <a
                        href={documentItem.downloadURL}
                        download
                        className={buttons.secondary}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>

                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => handleDelete(documentItem)}
                        className={buttons.danger}
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={glass.insetPadded}>
      <div className={typography.smallMuted}>
        {label}
      </div>

      <div className={["mt-1 break-all", typography.body].join(" ")}>
        {value || "—"}
      </div>
    </div>
  );
}


