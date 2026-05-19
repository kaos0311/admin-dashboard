"use client";

import { useRef, useState, type RefObject } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  type DocumentReference,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import toast from "react-hot-toast";

import { auth, db, storage } from "@/lib/firebase";

import { makeDuplicateImportKey } from "../lib/orderKeys";
import {
  detectReportTypeFromFile,
  findRecentDuplicateImport,
} from "../lib/orderImportDetection";
import type { ImportReportType, SmartDetectionResult } from "../lib/orderTypes";

async function setDocSafe(
  docRef: DocumentReference,
  payload: Record<string, unknown>
): Promise<void> {
  await setDoc(docRef, payload, { merge: true });
}

function getCurrentUserLabel(): string {
  return (
    auth.currentUser?.displayName ||
    auth.currentUser?.email ||
    auth.currentUser?.uid ||
    "Unknown user"
  );
}

export function useOrderImport(): {
  importType: ImportReportType;
  setImportType: (value: ImportReportType) => void;
  detectedImport: SmartDetectionResult | null;
  importing: boolean;
  importMessage: string;
  importInputRef: RefObject<HTMLInputElement | null>;
  handleDetectImportFile: (file: File | null) => Promise<void>;
  handleImportFile: (file: File | null) => Promise<void>;
} {
  const [importType, setImportTypeState] =
    useState<ImportReportType>("deliveryTickets");
  const [detectedImport, setDetectedImport] =
    useState<SmartDetectionResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const importInputRef = useRef<HTMLInputElement | null>(null);

  function setImportType(value: ImportReportType) {
    setImportTypeState(value);
    setDetectedImport(null);
  }

  async function handleDetectImportFile(file: File | null): Promise<void> {
    if (!file) {
      setDetectedImport(null);
      return;
    }

    try {
      const detection = await detectReportTypeFromFile(file);
      setDetectedImport(detection);
      setImportTypeState(detection.reportType);
    } catch (error: unknown) {
      console.error("IMPORT DETECTION ERROR:", error);
      setDetectedImport(null);
      toast.error("Failed to inspect report file.");
    }
  }

  async function handleImportFile(file: File | null): Promise<void> {
    if (!file || importing) return;

    try {
      setImporting(true);
      setImportMessage("Detecting report type.");

      const detection = detectedImport ?? (await detectReportTypeFromFile(file));
      const resolvedImportType = detection.reportType;

      setImportTypeState(resolvedImportType);
      setDetectedImport(detection);

      setImportMessage("Checking for duplicate upload.");

      const duplicateKey = makeDuplicateImportKey(file, resolvedImportType);
      const duplicate = await findRecentDuplicateImport(duplicateKey);

      if (
        duplicate &&
        duplicate.status !== "failed" &&
        duplicate.status !== "empty"
      ) {
        toast.error(
          `Possible duplicate: ${duplicate.fileName} was already uploaded.`
        );
        setImportMessage("");
        return;
      }

      setImportMessage("Creating secure import job.");

      const importJobRef = doc(collection(db, "importJobs"));
      const importId = importJobRef.id;

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const storagePath = `reports/uploads/${resolvedImportType}/${importId}/${safeFileName}`;
      const storageRef = ref(storage, storagePath);

      await setDocSafe(importJobRef, {
        reportType: resolvedImportType,
        detectedReportType: detection.reportType,
        detectionConfidence: detection.confidence,
        detectionReasons: detection.reasons,

        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
        storagePath,

        duplicateKey,
        status: "uploaded",

        rowCount: 0,
        skippedHospiceRows: 0,
        duplicateRows: 0,
        missingDobRows: 0,
        missingAddressRows: 0,
        missingProductRows: 0,
        needsReviewRows: 0,

        errorMessage: "",

        smartRoutingEnabled: true,
        expectedRouteTargets: [
          "orders",
          "patients",
          "hospicePatients",
          "insurancePatients",
          "analytics",
          "review",
        ],

        containsPhi: true,
        hipaaRestricted: true,
        clientVisibleHistory: false,

        createdBy: getCurrentUserLabel(),
        createdByUid: auth.currentUser?.uid ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setImportMessage("Uploading protected report file.");

      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          importId,
          reportType: resolvedImportType,
          detectedReportType: detection.reportType,
          detectionConfidence: String(detection.confidence),
          duplicateKey,
          originalName: file.name,
          smartRoutingEnabled: "true",
          containsPhi: "true",
          hipaaRestricted: "true",
          createdByUid: auth.currentUser?.uid ?? "",
        },
      });

      setImportMessage("");
      toast.success("File uploaded. Smart import job created.");
    } catch (error: unknown) {
      console.error("IMPORT UPLOAD ERROR:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload report."
      );
      setImportMessage("");
    } finally {
      setImporting(false);
      setDetectedImport(null);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  return {
    importType,
    setImportType,
    detectedImport,
    importing,
    importMessage,
    importInputRef,
    handleDetectImportFile,
    handleImportFile,
  };
}