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

import { CommandHero } from "./components/CommandHero";
import { HospiceList } from "./components/HospiceList";
import { IssueList } from "./components/IssueList";
import { JarvisPanel } from "./components/JarvisPanel";
import { MiniCard } from "./components/MiniCard";
import { Panel } from "./components/Panel";
import { RecallList } from "./components/RecallList";
import { StatCard } from "./components/StatCard";
import { TaskList } from "./components/TaskList";
import { useCommandCenterData } from "./hooks/useCommandCenterData";
import { useJarvis } from "./hooks/useJarvis";

export default function CommandCenterPage() {
  const {
    hospice,
    recalls,
    stats,
    topIssues,
    topTasks,
    loading,
  } = useCommandCenterData();

  const {
    jarvisPrompt,
    setJarvisPrompt,
    jarvisAnswer,
    jarvisLoading,
    handleAskJarvis,
  } = useJarvis();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(248,113,113,0.10),_transparent_35%),#050505] px-4 py-6 text-white md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <CommandHero loading={loading} openIssues={stats.openIssues} />

        <JarvisPanel
          jarvisPrompt={jarvisPrompt}
          jarvisAnswer={jarvisAnswer}
          jarvisLoading={jarvisLoading}
          setJarvisPrompt={setJarvisPrompt}
          handleAskJarvis={handleAskJarvis}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MiniCard title="Missing CMNs" value={stats.missingCmns} />
          <MiniCard title="Expired PARs" value={stats.expiredPars} />
          <MiniCard title="Missing Serials" value={stats.missingSerials} />
          <MiniCard title="Hospice Records" value={stats.hospiceRecords} />
          <MiniCard title="Active Recalls" value={stats.activeRecalls} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Priority Compliance Issues"
            subtitle="Highest-risk open issues first."
            icon={<Stethoscope className="h-5 w-5 text-red-300" />}
          >
            <IssueList issues={topIssues} />
          </Panel>

          <Panel
            title="Task Escalation"
            subtitle="Open, blocked, and urgent work."
            icon={<ClipboardList className="h-5 w-5 text-blue-300" />}
          >
            <TaskList tasks={topTasks} />
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="Hospice Oversight"
            subtitle="Active hospice monitoring."
            icon={<HeartPulse className="h-5 w-5 text-pink-300" />}
          >
            <HospiceList records={hospice} />
          </Panel>

          <Panel
            title="Active Equipment Recalls"
            subtitle="Recall records marked active."
            icon={<Wrench className="h-5 w-5 text-orange-300" />}
          >
            <RecallList recalls={recalls} />
          </Panel>
        </section>
      </div>
    </main>
  );
}