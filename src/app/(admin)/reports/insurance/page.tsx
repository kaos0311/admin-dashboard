"use client";

import {
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  WalletCards,
} from "lucide-react";

import { colors, glass } from "@/theme";

import { useInsuranceData } from "./hooks/useInsuranceData";
import InsurancePageHeader from "./components/InsurancePageHeader";
import ReadinessCardsGrid from "./components/ReadinessCardsGrid";
import FocusAreaCardsGrid from "./components/FocusAreaCardsGrid";
import JarvisScanPanel from "./components/JarvisScanPanel";
import InsuranceBridgeSection from "./components/InsuranceBridgeSection";
import QueueFeedSection from "./components/QueueFeedSection";

const FOCUS_AREA_ICONS = [
  WalletCards,
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
] as const;

export default function InsuranceReportPage() {
  const {
    bridge,
    payerSummaries,
    openQueueItems,
    selectedPayerReport,
    selectedPayerReportName,
    setSelectedPayerReportName,
    jarvisScanLoading,
    jarvisScanAnswer,
    jarvisScanError,
    readinessItems,
    focusAreas,
    handleRunInsuranceWebScan,
    handleDownloadPayerReport,
  } = useInsuranceData();

  const focusAreasWithIcons = focusAreas.map((area, index) => ({
    ...area,
    icon: FOCUS_AREA_ICONS[index],
  }));

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} aria-hidden="true" />

      <div className={`${glass.shell} relative z-10`}>
        <InsurancePageHeader />

        {bridge.error ? (
          <section className={glass.alertWarning}>{bridge.error}</section>
        ) : null}

        <ReadinessCardsGrid items={readinessItems} />

        <FocusAreaCardsGrid areas={focusAreasWithIcons} />

        <JarvisScanPanel
          loading={jarvisScanLoading}
          answer={jarvisScanAnswer}
          error={jarvisScanError}
          onScan={handleRunInsuranceWebScan}
        />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <InsuranceBridgeSection
            bridge={bridge}
            payerSummaries={payerSummaries}
            selectedPayerReport={selectedPayerReport}
            selectedPayerReportName={selectedPayerReportName}
            onSelectPayerReport={setSelectedPayerReportName}
            onDownloadReport={handleDownloadPayerReport}
          />
          <QueueFeedSection items={openQueueItems} />
        </section>
      </div>
    </main>
  );
}
