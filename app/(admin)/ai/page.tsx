"use client";

import { useMemo, useState } from "react";

import { httpsCallable } from "firebase/functions";

import {
  AlertTriangle,
  Bot,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import toast from "react-hot-toast";

import { colors, glass, typography } from "@/theme";
import { functions } from "@/lib/firebase";

const askAdminAi = httpsCallable<{ prompt: string }, { answer?: string }>(
  functions,
  "askAdminAi"
);

const MAX_PROMPT_LENGTH = 4000;

const SUGGESTED_PROMPTS = [
  "Summarize current operational risks.",
  "Show import processing concerns.",
  "What tasks are escalated?",
  "Summarize audit activity.",
  "Check hospice oversight status.",
  "Identify operational bottlenecks.",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "AI request failed.";
}

export default function AdminAiPage() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanPrompt = useMemo(() => prompt.trim(), [prompt]);

  const remainingCharacters = MAX_PROMPT_LENGTH - prompt.length;

  const canSubmit =
    cleanPrompt.length > 0 &&
    prompt.length <= MAX_PROMPT_LENGTH &&
    !loading;

  async function handleAsk() {
    if (!cleanPrompt) {
      toast.error("Enter a question first.");
      return;
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      toast.error(
        `Question exceeds ${MAX_PROMPT_LENGTH} character limit.`
      );

      return;
    }

    setLoading(true);
    setAnswer("");
    setErrorMessage("");

    try {
      const result = await askAdminAi({
        prompt: cleanPrompt,
      });

      const responseAnswer = result.data?.answer?.trim();

      if (!responseAnswer) {
        setErrorMessage("AI returned an empty response.");
        toast.error("AI returned an empty response.");
        return;
      }

      setAnswer(responseAnswer);
    } catch (error) {
      console.error("AI REQUEST ERROR:", error);

      const message = getErrorMessage(error);

      setErrorMessage(message);

      toast.error(
        message.toLowerCase().includes("quota")
          ? "OpenAI billing or quota issue."
          : "AI request failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();

      if (canSubmit) {
        void handleAsk();
      }
    }
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <section className={glass.panel}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                <ShieldCheck className="h-3.5 w-3.5" />
                Stark Command Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Admin AI Command Center
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Operational AI for imports, audit activity,
                  compliance risk, hospice oversight, report health,
                  recalls, WIP bottlenecks, and system diagnostics.
                  Because staring at spreadsheets until your soul leaves
                  your body is apparently still considered “workflow.”
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                  <Bot className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      Jarvis Online
                    </p>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />
                      Active
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Firebase Callable • OpenAI Connected
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          <section className={glass.panel}>
            <div className={colors.grid} />

            <div className="relative p-5">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <label
                    htmlFor="admin-ai-prompt"
                    className={typography.label}
                  >
                    Ask Jarvis
                  </label>

                  <p className="mt-2 text-sm text-slate-400">
                    Use Ctrl/⌘ + Enter to send.
                  </p>
                </div>

                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    remainingCharacters < 0
                      ? "bg-red-500/10 text-red-300"
                      : "bg-white/[0.06] text-slate-400"
                  }`}
                >
                  {remainingCharacters} left
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setPrompt(suggestion)}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-300 transition hover:border-sky-200/30 hover:bg-sky-100/10 hover:text-white hover:shadow-[0_0_18px_rgba(186,230,253,0.18)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <textarea
                id="admin-ai-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Example: Summarize today's high-risk audit activity and identify operational concerns."
                className={`min-h-[260px] w-full resize-none rounded-3xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 shadow-inner shadow-black/20 backdrop-blur-xl focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20`}
              />

              {errorMessage ? (
                <div className="mt-4 flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <p className="max-w-2xl text-xs leading-6 text-slate-500">
                  Keep prompts operational. Avoid PHI unless your
                  infrastructure is explicitly configured for compliant
                  handling. Lawyers travel in packs and feed on weak
                  documentation.
                </p>

                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}

                  {loading ? "Thinking..." : "Ask Jarvis"}
                </button>
              </div>
            </div>
          </section>

          <section className={glass.panel}>
            <div className={colors.grid} />

            <div className="relative p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                  <Sparkles className="h-4 w-4" />
                </div>

                <div>
                  <p className={typography.caption}>
                    AI Response
                  </p>

                  <p className="text-sm text-slate-400">
                    Operational analysis from Jarvis
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-6">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-200" />

                    <p className="mt-4 text-sm text-slate-400">
                      Running operational analysis...
                    </p>
                  </div>
                </div>
              ) : answer ? (
                <div className="max-h-[760px] overflow-auto whitespace-pre-wrap rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-100 shadow-inner">
                  {answer}
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                  <div>
                    <Bot className="mx-auto h-8 w-8 text-slate-600" />

                    <p className="mt-4 text-sm font-medium text-slate-300">
                      Awaiting operational query
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Responses from Jarvis will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}







