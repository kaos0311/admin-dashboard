import { ReportSectionGrid } from "./components/ReportSectionGrid";
import { ReportsHero } from "./components/ReportsHero";
import { UploadRuleCard } from "./components/UploadRuleCard";

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_30%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <ReportsHero />
        <ReportSectionGrid />
        <UploadRuleCard />
      </div>
    </main>
  );
}