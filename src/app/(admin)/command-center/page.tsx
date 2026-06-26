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

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { colors, glass, spacing } from "@/theme";

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
  const {
    hospice,
    recalls,
    stats: commandStats,
    topIssues,
    topTasks,
    loading: commandLoading,
  } = useCommandCenterData();
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

  const loading = commandLoading || productionLoading;

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div aria-hidden="true" className={colors.grid} />
      <div aria-hidden="true" className={colors.vignette} />

      <div className={`${glass.shell} ${spacing.page} ${spacing.stack}`}>
        <CommandHero loading={loading} openIssues={commandStats.openIssues} />

        {/* Dedicated Jarvis Chat Window */}
        <section
          aria-label="Jarvis command intelligence"
          className="w-full"
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
        </section>

        <section
          aria-label="Command center primary statistics"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            title="Open Compliance Issues"
            value={commandStats.openIssues}
            icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
            tone="red"
            href="/command-center?focus=open-issues#priority-compliance-issues"
          />
          <StatCard
            title="Critical Issues"
            value={commandStats.criticalIssues}
            icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
              tone="orange"
              href="/command-center?focus=critical-issues#priority-compliance-issues"
            />
            <StatCard
              title="Open Tasks"
              value={commandStats.openTasks}
              icon={<ClipboardList className="h-5 w-5" aria-hidden />}
              tone="blue"
              href="/command-center?focus=open-tasks#task-escalation"
            />
            <StatCard
              title="Escalated Tasks"
              value={commandStats.escalatedTasks}
              icon={<FileWarning className="h-5 w-5" aria-hidden />}
              tone="yellow"
              href="/command-center?focus=escalated-tasks#task-escalation"
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
            <MiniCard
              title="Missing CMNs"
              value={commandStats.missingCmns}
              href="/command-center?issueType=missing_cmn#priority-compliance-issues"
              tone="yellow"
            />
            <MiniCard
              title="Expired PARs"
              value={commandStats.expiredPars}
              href="/command-center?issueType=expired_par#priority-compliance-issues"
              tone="yellow"
            />
            <MiniCard
              title="Missing Serials"
              value={commandStats.missingSerials}
              href="/command-center?issueType=missing_serial#priority-compliance-issues"
              tone="orange"
            />
            <MiniCard
              title="Hospice Records"
              value={commandStats.hospiceRecords}
              href="/command-center?focus=hospice#hospice-oversight"
              tone="blue"
            />
            <MiniCard
              title="Active Recalls"
              value={commandStats.activeRecalls}
              href="/command-center?focus=recalls#active-equipment-recalls"
              tone="red"
            />
          </section>

          <section
            aria-label="Compliance and task escalation"
            className="grid gap-6 xl:grid-cols-2"
          >
            <Panel
              id="priority-compliance-issues"
              title="Priority Compliance Issues"
              subtitle="Highest-risk open issues first."
              icon={<Stethoscope className="h-5 w-5" />}
            >
              <IssueList issues={topIssues} />
            </Panel>

            <Panel
              id="task-escalation"
              title="Task Escalation"
              subtitle="Open, blocked, and urgent work."
              icon={<ClipboardList className="h-5 w-5" />}
            >
              <TaskList tasks={topTasks} />
            </Panel>
          </section>

          <section
            aria-label="Hospice and equipment recall oversight"
            className="grid gap-6 xl:grid-cols-2"
          >
            <Panel
              id="hospice-oversight"
              title="Hospice Oversight"
              subtitle="Active hospice monitoring."
              icon={<HeartPulse className="h-5 w-5" />}
            >
              <HospiceList records={hospice} />
            </Panel>

            <Panel
              id="active-equipment-recalls"
              title="Active Equipment Recalls"
              subtitle="Recall records marked active."
              icon={<Wrench className="h-5 w-5" />}
            >
              <RecallList recalls={recalls} />
            </Panel>
          </section>
      </div>
    </main>
  );
}
