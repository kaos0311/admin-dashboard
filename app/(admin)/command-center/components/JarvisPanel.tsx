import { Bot, Loader2, Send, Sparkles } from "lucide-react";

type JarvisPanelProps = {
  jarvisPrompt: string;
  jarvisAnswer: string;
  jarvisLoading: boolean;
  setJarvisPrompt: (value: string) => void;
  handleAskJarvis: () => void;
};

export function JarvisPanel({
  jarvisPrompt,
  jarvisAnswer,
  jarvisLoading,
  setJarvisPrompt,
  handleAskJarvis,
}: JarvisPanelProps) {
  return (
    <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/30 via-white/[0.06] to-neutral-950 p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
          <Bot className="h-6 w-6" />
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            Jarvis
            <Sparkles className="h-4 w-4 text-cyan-300" />
          </h2>

          <p className="mt-1 text-sm text-neutral-400">
            Ask Jarvis about imports, compliance risk, audit activity, task
            escalation, recalls, and system health.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label
            htmlFor="jarvis-prompt"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"
          >
            Ask Jarvis
          </label>

          <textarea
            id="jarvis-prompt"
            value={jarvisPrompt}
            onChange={(event) => setJarvisPrompt(event.target.value)}
            placeholder="Example: What command center issues need attention first?"
            className="min-h-[170px] w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
          />

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleAskJarvis}
              disabled={jarvisLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-200 px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {jarvisLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}

              {jarvisLoading ? "Jarvis is thinking..." : "Ask Jarvis"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Jarvis Response
          </p>

          {jarvisAnswer ? (
            <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-neutral-950/80 p-4 text-sm leading-6 text-neutral-100">
              {jarvisAnswer}
            </div>
          ) : (
            <div className="flex min-h-[170px] items-center rounded-2xl border border-dashed border-white/10 bg-neutral-950/50 p-4 text-sm leading-6 text-neutral-500">
              No response yet. Ask a useful question, preferably before the
              spreadsheet gods demand another sacrifice.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}