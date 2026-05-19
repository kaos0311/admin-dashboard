"use client";

import { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  Bot,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

const functions = getFunctions(undefined, "us-central1");

const askAdminAi = httpsCallable<{ prompt: string }, { answer?: string }>(
  functions,
  "askAdminAi"
);

const MAX_PROMPT_LENGTH = 4000;

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
      toast.error(`Question is too long. Limit is ${MAX_PROMPT_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setAnswer("");
    setErrorMessage("");

    try {
      const result = await askAdminAi({ prompt: cleanPrompt });
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
          ? "OpenAI quota or billing issue."
          : "AI request failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();

      if (canSubmit) {
        void handleAsk();
      }
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff_45%,#f8fafc)] px-4 py-6 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_32%),linear-gradient(135deg,#020617,#111827_48%,#020617)] dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Command Intelligence
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Admin AI Command Center
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Ask operational questions about imports, audit activity,
                  report health, patient counts, hospice detection, and system
                  status. Useful when the dashboard is acting like it was wired
                  by raccoons.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/65 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-600/10 p-3 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                  <Bot className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Jarvis Online
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Callable: askAdminAi
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <section className="rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-slate-200/60 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="admin-ai-prompt"
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
                >
                  Ask AI
                </label>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Use Ctrl/⌘ + Enter to submit.
                </p>
              </div>

              <div
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  remainingCharacters < 0
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : "bg-slate-900/5 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                }`}
              >
                {remainingCharacters} left
              </div>
            </div>

            <textarea
              id="admin-ai-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Example: Summarize today's high-risk audit activity and flag any import issues."
              className="min-h-[220px] w-full resize-y rounded-3xl border border-slate-200/80 bg-white/75 p-4 text-sm leading-6 text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-blue-400/70 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-blue-300/50 dark:focus:ring-blue-300/10"
            />

            {errorMessage ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-500">
                Keep prompts operational. No PHI unless your backend is built to
                safely handle it. Because lawsuits are expensive and paperwork is
                where souls go to rot.
              </p>

              <button
                type="button"
                onClick={handleAsk}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}

                {loading ? "Thinking..." : "Ask AI"}
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-slate-200/60 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/30">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-2xl bg-violet-600/10 p-2 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Answer
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Response from Admin AI
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-slate-200/80 bg-white/60 p-6 dark:border-white/10 dark:bg-black/20">
                <div className="text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-500 dark:text-slate-400" />
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Checking the system without pretending magic is involved.
                  </p>
                </div>
              </div>
            ) : answer ? (
              <div className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-3xl border border-slate-200/80 bg-white/75 p-4 text-sm leading-6 text-slate-800 shadow-inner dark:border-white/10 dark:bg-black/20 dark:text-slate-100">
                {answer}
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed border-slate-300/80 bg-white/40 p-6 text-center dark:border-white/10 dark:bg-black/20">
                <div>
                  <Bot className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                    No answer yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">
                    Ask a question and the response will appear here.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}