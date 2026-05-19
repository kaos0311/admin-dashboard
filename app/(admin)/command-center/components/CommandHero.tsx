import { Loader2 } from "lucide-react";

type CommandHeroProps = {
  loading: boolean;
  openIssues: number;
};

export function CommandHero({ loading, openIssues }: CommandHeroProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-neutral-950/90 to-red-950/30 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
            Operations Intelligence
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Command Center
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
            Central oversight for compliance problems, task escalation, hospice
            risk, recalls, and patient operations. This is where the database
            stops being a junk drawer with Wi-Fi.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-300 backdrop-blur-xl">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading command data
            </span>
          ) : (
            <span>
              Monitoring <strong className="text-white">{openIssues}</strong>{" "}
              open issues
            </span>
          )}
        </div>
      </div>
    </section>
  );
}