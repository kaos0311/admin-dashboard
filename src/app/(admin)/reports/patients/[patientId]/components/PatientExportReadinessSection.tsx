"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  ClipboardCheck,
  FileDown,
  FileText,
  Printer,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

import { auth, db } from "@/lib/firebase";
import { badges, buttons, colors, glass, typography } from "@/theme";

import type { PatientRecord } from "../patient-detail-types";

type PatientDocument = {
  id: string;
  documentType: string;
  fileName: string;
  originalFileName: string;
  contentType: string;
};

type PacketDefinition = {
  id: string;
  label: string;
  documentTypes: string[];
  purpose: string;
};

const PACKETS: PacketDefinition[] = [
  {
    id: "full-chart",
    label: "Full Chart",
    documentTypes: [],
    purpose: "General medical chart review and complete patient record handling.",
  },
  {
    id: "delivery",
    label: "Delivery Ticket Packet",
    documentTypes: ["Delivery Ticket", "Signed Delivery Ticket", "Delivery Signature"],
    purpose: "Delivery confirmation, signatures, equipment proof, and tech workflow.",
  },
  {
    id: "insurance",
    label: "Insurance Audit Packet",
    documentTypes: ["Insurance Document", "Authorization", "CMN", "Physician Order"],
    purpose: "Payer review, PAR/CMN accuracy, and billing support.",
  },
  {
    id: "damage-service",
    label: "Damage / Service Packet",
    documentTypes: ["Damage Photo", "Pickup Ticket", "Signed Pickup Ticket"],
    purpose: "Returned equipment, damage photos, missing parts, and service review.",
  },
];

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function hasPacketDocuments(packet: PacketDefinition, documents: PatientDocument[]) {
  if (packet.id === "full-chart") return documents.length > 0;

  return documents.some((documentItem) =>
    packet.documentTypes.some((type) =>
      normalize(documentItem.documentType).toLowerCase().includes(type.toLowerCase())
    )
  );
}

function packetDocuments(packet: PacketDefinition, documents: PatientDocument[]) {
  if (packet.id === "full-chart") return documents;

  return documents.filter((documentItem) =>
    packet.documentTypes.some((type) =>
      normalize(documentItem.documentType).toLowerCase().includes(type.toLowerCase())
    )
  );
}

function printPacket(patient: PatientRecord, packet: PacketDefinition, documents: PatientDocument[]) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;

  const rows = documents
    .map(
      (documentItem) => `
        <tr>
          <td>${documentItem.documentType || ""}</td>
          <td>${documentItem.originalFileName || documentItem.fileName || ""}</td>
          <td>${documentItem.contentType || ""}</td>
        </tr>
      `
    )
    .join("");

  popup.document.write(`<!doctype html><html><head><title>${packet.label}</title><style>
    body{font-family:Arial,sans-serif;margin:24px;color:#111}
    h1{font-size:22px;margin:0 0 12px}
    h2{font-size:16px;margin:20px 0 8px}
    p{font-size:13px;line-height:1.5}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}
    .muted{color:#555;font-size:12px}
  </style></head><body>
    <h1>${packet.label}</h1>
    <p><strong>Patient:</strong> ${patient.fullName}</p>
    <p><strong>DOB:</strong> ${patient.dateOfBirth || ""}</p>
    <p><strong>Insurance:</strong> ${normalize(patient.insurance?.insuranceName || patient.insurance?.payer || "")}</p>
    <p><strong>Purpose:</strong> ${packet.purpose}</p>
    <h2>Included Document Index</h2>
    <table><thead><tr><th>Type</th><th>File</th><th>Content</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted">This packet is an index/cover sheet. Original PDFs and images remain preserved exactly as uploaded in the patient chart.</p>
  </body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function PatientExportReadinessSection({
  patient,
}: {
  patient: PatientRecord;
}) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const documentsQuery = query(
      collection(db, "patients", patient.id, "documents"),
      orderBy("uploadedAt", "desc")
    );

    return onSnapshot(
      documentsQuery,
      (snapshot) => {
        setDocuments(
          snapshot.docs.map((documentSnapshot) => {
            const data = documentSnapshot.data();

            return {
              id: documentSnapshot.id,
              documentType: normalize(data.documentType),
              fileName: normalize(data.fileName),
              originalFileName: normalize(data.originalFileName),
              contentType: normalize(data.contentType),
            };
          })
        );
        setLoading(false);
      },
      (error) => {
        console.error("PATIENT EXPORT READINESS ERROR:", error);
        toast.error("Could not load chart export readiness.");
        setLoading(false);
      }
    );
  }, [patient.id]);

  const packetRows = useMemo(() => {
    return PACKETS.map((packet) => {
      const includedDocuments = packetDocuments(packet, documents);

      return {
        packet,
        ready: hasPacketDocuments(packet, documents),
        documents: includedDocuments,
      };
    });
  }, [documents]);

  async function handlePrintPacket(packet: PacketDefinition) {
    const includedDocuments = packetDocuments(packet, documents);

    try {
      await addDoc(collection(db, "chartExportLogs"), {
        patientId: patient.id,
        patientName: patient.fullName,
        packetType: packet.id,
        packetLabel: packet.label,
        documentCount: includedDocuments.length,
        action: "packet_printed",
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "patients", patient.id, "timeline"), {
        type: "chart_packet_printed",
        title: `${packet.label} printed`,
        body: `${includedDocuments.length} document reference(s) included in the packet cover sheet.`,
        metadata: {
          packetType: packet.id,
          documentIds: includedDocuments.map((documentItem) => documentItem.id),
        },
        actorUid: auth.currentUser?.uid ?? null,
        actorEmail: auth.currentUser?.email ?? null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("CHART EXPORT LOG ERROR:", error);
      toast.error("Packet opened, but the export log could not be saved.");
    }

    printPacket(patient, packet, includedDocuments);
  }

  return (
    <div className="min-w-0 space-y-5 md:col-span-3">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={["min-w-0 rounded-2xl border p-4", colors.border, colors.surfaceInset].join(" ")}>
          <p className={typography.caption}>Chart Documents</p>
          <p className="mt-2 text-2xl font-black text-white">
            {loading ? "..." : documents.length}
          </p>
          <p className={["mt-1", typography.smallMuted].join(" ")}>
            Uploaded or generated records
          </p>
        </div>

        <div className={["min-w-0 rounded-2xl border p-4", colors.border, colors.surfaceInset].join(" ")}>
          <p className={typography.caption}>Ready Packets</p>
          <p className="mt-2 text-2xl font-black text-white">
            {packetRows.filter((row) => row.ready).length}/{PACKETS.length}
          </p>
          <p className={["mt-1", typography.smallMuted].join(" ")}>
            Available for print/export review
          </p>
        </div>

        <div className={["min-w-0 rounded-2xl border p-4", colors.border, colors.surfaceInset].join(" ")}>
          <p className={typography.caption}>Audit Guardrail</p>
          <p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-bold text-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            Logged
          </p>
          <p className={["mt-1", typography.smallMuted].join(" ")}>
            Packet prints create chart export logs
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {packetRows.map((row) => (
          <article
            key={row.packet.id}
            className={[glass.listItem, "min-w-0 p-4"].join(" ")}
          >
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className={["flex min-w-0 items-center gap-2", typography.bodyStrong].join(" ")}>
                  <FileText className="h-4 w-4 shrink-0 text-cyan-200" />
                  <span className="min-w-0 text-wrap">{row.packet.label}</span>
                </p>
                <p className={["mt-1", typography.smallMuted].join(" ")}>
                  {row.packet.purpose}
                </p>
                <p className={["mt-2", typography.smallMuted].join(" ")}>
                  {row.documents.length} matching document(s)
                </p>
              </div>

              <span
                className={[
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                  row.ready ? badges.active : badges.warning,
                ].join(" ")}
              >
                {row.ready ? "Ready" : "Needs docs"}
              </span>
            </div>

            <button
              type="button"
              disabled={!row.ready}
              onClick={() => void handlePrintPacket(row.packet)}
              className={[buttons.secondary, "mt-4"].join(" ")}
            >
              {row.packet.id === "full-chart" ? (
                <FileDown className="h-4 w-4" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>Print Packet Cover</span>
            </button>
          </article>
        ))}
      </div>

      <div className={["rounded-2xl border p-4", colors.border, colors.surfaceInset].join(" ")}>
        <p className={["flex items-center gap-2", typography.bodyStrong].join(" ")}>
          <ClipboardCheck className="h-4 w-4 shrink-0 text-cyan-200" />
          Minimum Necessary Reminder
        </p>
        <p className={["mt-2", typography.bodyMuted].join(" ")}>
          Export only the packet needed for the request, audit, payer review, or
          patient-care workflow. Original documents remain attached below for
          exact retrieval.
        </p>
      </div>
    </div>
  );
}
