"use client";

import {
  AlertTriangle,
  ClipboardList,
  FileWarning,
  HeartPulse,
  ShieldAlert,
  Stethoscope,
  Wrench,
} from "lucide-react";

import { colors, glass } from "@/theme";
import { useAuthRole } from "@/app/hooks/useAuthRole";

import { CommandHero } from "./components/CommandHero";
import { DatabaseHealthPanel } from "./components/DatabaseHealthPanel";
import { HospiceList } from "./components/HospiceList";
import { IssueList } from "./components/IssueList";
import { JarvisPanel } from "./components/JarvisPanel";
import { MiniCard } from "./components/MiniCard";
import { Panel } from "./components/Panel";
import { ProductionReadinessPanel } from "./components/ProductionReadinessPanel";
import { RecallList } from "./components/RecallList";
import { StatCard } from "./components/StatCard";
import { TaskList } from "./components/TaskList";
import { useCommandCenterData } from "./hooks/useCommandCenterData";
import { useJarvis } from "./hooks/useJarvis";
import { useProductionReadiness } from "./hooks/useProductionReadiness";

export default function CommandCenterPage() {
  const { isAdmin } = useAuthRole();
  const { hospice, recalls, stats, topIssues, topTasks, loading } =
    useCommandCenterData();
  const {
    alerts: productionAlerts,
    stats: productionStats,
    loading: productionLoading,
  } = useProductionReadiness(isAdmin);

  const {
    jarvisPrompt,
    setJarvisPrompt,
    jarvisAnswer,
    jarvisLoading,
    jarvisMessages,
    jarvisErrorMessage,
    remainingCharacters,
    canAskJarvis,
    handleAskJarvis,
    handleRunPhiScan,
    clearJarvisMessages,
  } = useJarvis();

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <CommandHero loading={loading} openIssues={stats.openIssues} />

        <section
          aria-label="Jarvis command intelligence and database health"
          className="grid w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
        >
          <JarvisPanel
            jarvisPrompt={jarvisPrompt}
            jarvisAnswer={jarvisAnswer}
            jarvisLoading={jarvisLoading}
            jarvisMessages={jarvisMessages}
            jarvisErrorMessage={jarvisErrorMessage}
            remainingCharacters={remainingCharacters}
            canAskJarvis={canAskJarvis}
            setJarvisPrompt={setJarvisPrompt}
            handleAskJarvis={handleAskJarvis}
            handleRunPhiScan={handleRunPhiScan}
            clearJarvisMessages={clearJarvisMessages}
          />

          <DatabaseHealthPanel stats={stats} loading={loading} />
        </section>

        <section
          aria-label="Command center primary statistics"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            title="Open Compliance Issues"
            value={stats.openIssues}
            icon={<ShieldAlert className="h-5 w-5" />}
            tone="red"
          />

          <StatCard
            title="Critical Issues"
            value={stats.criticalIssues}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="orange"
          />

          <StatCard
            title="Open Tasks"
            value={stats.openTasks}
            icon={<ClipboardList className="h-5 w-5" />}
            tone="blue"
          />

          <StatCard
            title="Escalated Tasks"
            value={stats.escalatedTasks}
            icon={<FileWarning className="h-5 w-5" />}
            tone="yellow"
          />
        </section>

        <ProductionReadinessPanel
          alerts={productionAlerts}
          stats={productionStats}
          loading={productionLoading}
        />

        <section
          aria-label="Command center secondary statistics"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          <MiniCard title="Missing CMNs" value={stats.missingCmns} />
          <MiniCard title="Expired PARs" value={stats.expiredPars} />
          <MiniCard title="Missing Serials" value={stats.missingSerials} />
          <MiniCard title="Hospice Records" value={stats.hospiceRecords} />
          <MiniCard title="Active Recalls" value={stats.activeRecalls} />
        </section>

        <section
          aria-label="Compliance and task escalation"
          className="grid gap-6 xl:grid-cols-2"
        >
          <Panel
            title="Priority Compliance Issues"
            subtitle="Highest-risk open issues first."
            icon={<Stethoscope className="h-5 w-5 text-sky-200" />}
          >
            <IssueList issues={topIssues} />
          </Panel>

          <Panel
            title="Task Escalation"
            subtitle="Open, blocked, and urgent work."
            icon={<ClipboardList className="h-5 w-5 text-sky-200" />}
          >
            <TaskList tasks={topTasks} />
          </Panel>
        </section>

        <section
          aria-label="Hospice and equipment recall oversight"
          className="grid gap-6 xl:grid-cols-2"
        >
          <Panel
            title="Hospice Oversight"
            subtitle="Active hospice monitoring."
            icon={<HeartPulse className="h-5 w-5 text-sky-200" />}
          >
            <HospiceList records={hospice} />
          </Panel>

          <Panel
            title="Active Equipment Recalls"
            subtitle="Recall records marked active."
            icon={<Wrench className="h-5 w-5 text-sky-200" />}
          >
            <RecallList recalls={recalls} />
          </Panel>
        </section>
      </div>
    </main>
  );
}



