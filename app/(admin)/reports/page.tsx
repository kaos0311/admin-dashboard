import { colors, glass } from "@/theme";

import { ReportSectionGrid } from "./components/ReportSectionGrid";
import { ReportsHero } from "./components/ReportsHero";
import { UploadRuleCard } from "./components/UploadRuleCard";

export default function ReportsPage() {
  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <ReportsHero />

        <section aria-label="Report sections">
          <ReportSectionGrid />
        </section>

        <section aria-label="Upload rules">
          <UploadRuleCard />
        </section>
      </div>
    </main>
  );
}



