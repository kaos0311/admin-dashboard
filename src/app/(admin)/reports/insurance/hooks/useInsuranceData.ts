"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  buildFocusAreas,
  buildPayerIssueReport,
  buildPayerSummaries,
  buildReadinessItems,
  buildReportText,
  COLLECTION_LIMIT,
  getDateValue,
  hasDocumentationGap,
  initialBridgeState,
  isCoverageIssue,
  isOpenQueueRecord,
  askAdminAi,
} from "../lib/insuranceUtils";
import type {
  InsuranceBridgeState,
  PayerIssueReport,
} from "../types";

export function useInsuranceData() {
  const [bridge, setBridge] =
    useState<InsuranceBridgeState>(initialBridgeState);
  const [jarvisScanLoading, setJarvisScanLoading] = useState(false);
  const [jarvisScanAnswer, setJarvisScanAnswer] = useState("");
  const [jarvisScanError, setJarvisScanError] = useState("");
  const [selectedPayerReportName, setSelectedPayerReportName] = useState("");

  /* ── Firestore subscriptions ─────────────────────────────────── */

  useEffect(() => {
    const loaded = {
      payers: false,
      coverageRecords: false,
      insurancePatients: false,
      queueItems: false,
      authorizations: false,
    };

    function markLoaded(key: keyof typeof loaded) {
      loaded[key] = true;
      if (Object.values(loaded).every(Boolean)) {
        setBridge((current) => ({ ...current, loading: false }));
      }
    }

    function subscribe(
      collectionName: string,
      key: keyof Omit<InsuranceBridgeState, "loading" | "error">
    ) {
      return onSnapshot(
        query(collection(db, collectionName), limit(COLLECTION_LIMIT)),
        (snapshot) => {
          setBridge((current) => ({
            ...current,
            [key]: snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            })),
            error: "",
          }));
          markLoaded(key);
        },
        (error) => {
          console.error(
            `INSURANCE BRIDGE ${collectionName} SNAPSHOT ERROR:`,
            error
          );
          setBridge((current) => ({
            ...current,
            loading: false,
            error:
              "Unable to load one or more insurance bridge collections.",
          }));
        }
      );
    }

    const unsubscribers = [
      subscribe("insurance", "payers"),
      subscribe("insuranceRecords", "coverageRecords"),
      subscribe("insurancePatients", "insurancePatients"),
      subscribe("insuranceQueue", "queueItems"),
      subscribe("patientAuthorizations", "authorizations"),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  /* ── Derived data ────────────────────────────────────────────── */

  const payerSummaries = useMemo(
    () => buildPayerSummaries(bridge.payers, bridge.coverageRecords),
    [bridge.coverageRecords, bridge.payers]
  );

  const openQueueItems = useMemo(
    () =>
      [...bridge.queueItems, ...bridge.authorizations]
        .filter(isOpenQueueRecord)
        .sort((a, b) => getDateValue(a).localeCompare(getDateValue(b)))
        .slice(0, 10),
    [bridge.authorizations, bridge.queueItems]
  );

  const coverageIssues = useMemo(
    () => bridge.coverageRecords.filter(isCoverageIssue),
    [bridge.coverageRecords]
  );

  const documentationGaps = useMemo(
    () =>
      [...bridge.queueItems, ...bridge.authorizations].filter(
        hasDocumentationGap
      ),
    [bridge.authorizations, bridge.queueItems]
  );

  const selectedPayerReport = useMemo<PayerIssueReport | null>(
    () =>
      selectedPayerReportName
        ? buildPayerIssueReport(selectedPayerReportName, bridge)
        : null,
    [bridge, selectedPayerReportName]
  );

  const readinessItems = useMemo(
    () =>
      buildReadinessItems(
        bridge.payers.length,
        bridge.coverageRecords.length,
        openQueueItems.length,
        coverageIssues.length,
        documentationGaps.length
      ),
    [
      bridge.payers.length,
      bridge.coverageRecords.length,
      coverageIssues.length,
      documentationGaps.length,
      openQueueItems.length,
    ]
  );

  const focusAreas = useMemo(
    () =>
      buildFocusAreas(
        bridge.payers.length,
        bridge.insurancePatients.length,
        openQueueItems.length,
        coverageIssues.length
      ),
    [
      bridge.payers.length,
      bridge.insurancePatients.length,
      coverageIssues.length,
      openQueueItems.length,
    ]
  );

  /* ── Actions ─────────────────────────────────────────────────── */

  async function handleRunInsuranceWebScan() {
    if (jarvisScanLoading) return;

    setJarvisScanLoading(true);
    setJarvisScanError("");

    try {
      const result = await askAdminAi({
        prompt:
          "Insurance web scan: search reliable internet sources for current insurance changes, payer updates, DME/HME authorization requirements, prior authorization changes, documentation requirements, and billing requirements. Prioritize CMS, Medicare, Medicaid, DME MACs, state Medicaid programs, and official payer provider policy pages. Return source organization, topic, change or requirement, effective date if visible, billing or authorization impact, direct URL, date checked, and what staff should verify before changing workflow.",
      });

      setJarvisScanAnswer(
        result.data.answer?.trim() ||
          "Jarvis did not return a scan result."
      );
    } catch (error) {
      console.error("INSURANCE JARVIS WEB SCAN ERROR:", error);
      setJarvisScanError(
        error instanceof Error
          ? error.message
          : "Jarvis insurance web scan failed."
      );
    } finally {
      setJarvisScanLoading(false);
    }
  }

  function handleDownloadPayerReport(report: PayerIssueReport) {
    const safeName =
      report.payerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "payer";
    const reportText = buildReportText(report);
    const blob = new Blob([reportText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `insurance-bridge-${safeName}-issues.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return {
    /* Bridge data */
    bridge,
    payerSummaries,
    openQueueItems,
    coverageIssues,
    documentationGaps,
    selectedPayerReport,
    selectedPayerReportName,
    setSelectedPayerReportName,
    jarvisScanLoading,
    jarvisScanAnswer,
    jarvisScanError,
    readinessItems,
    focusAreas,
    /* Actions */
    handleRunInsuranceWebScan,
    handleDownloadPayerReport,
  };
}
