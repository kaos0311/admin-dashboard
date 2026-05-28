"use client";

import { useEffect, useRef } from "react";
import {
  Bot,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

import type { JarvisMessage } from "../hooks/useJarvis";

type JarvisPanelProps = {
  jarvisPrompt: string;
  jarvisAnswer: string;
  jarvisLoading: boolean;
  jarvisMessages?: JarvisMessage[];
  jarvisErrorMessage?: string;
  remainingCharacters?: number;
  canAskJarvis?: boolean;
  setJarvisPrompt: (value: string) => void;
  handleAskJarvis: () => void;
  clearJarvisMessages?: () => void;
};

const SUGGESTED_PROMPTS = [
  "What needs immediate attention?",
  "Summarize current compliance risks.",
  "Show operational bottlenecks.",
  "What imports failed recently?",
  "Which tasks are escalated?",
  "Summarize hospice oversight.",
];

export function JarvisPanel({
  jarvisPrompt,
  jarvisAnswer,
  jarvisLoading,
  jarvisMessages = [],
  jarvisErrorMessage = "",
  remainingCharacters = 4000 - jarvisPrompt.length,
  canAskJarvis,
  setJarvisPrompt,
  handleAskJarvis,
  clearJarvisMessages,
}: JarvisPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const submitDisabled =
    typeof canAskJarvis === "boolean"
      ? !canAskJarvis
      : jarvisLoading || jarvisPrompt.trim().length === 0;

  const visibleMessages =
    jarvisMessages.length > 0
      ? jarvisMessages
      : jarvisAnswer
        ? [
            {
              id: "jarvis-answer",
              role: "assistant" as const,
              content: jarvisAnswer,
              createdAt: Date.now(),
            },
          ]
        : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages.length, jarvisLoading]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();

    if (!submitDisabled) {
      handleAskJarvis();
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-sky-200/20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(125,211,252,0.20),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.94))] shadow-[0_0_55px_rgba(125,211,252,0.18)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-200/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <div className="relative border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-sky-200/20 bg-white/10 p-2 text-sky-100 shadow-[0_0_25px_rgba(186,230,253,0.35)]">
              <Bot className="h-6 w-6" />
            </div>

            <div>
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-white">
                Jarvis
                <Sparkles className="h-4 w-4 text-sky-100" />
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200/20 bg-sky-100/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-100 shadow-[0_0_18px_rgba(186,230,253,0.35)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />
                  Online
                </span>
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                Stark-style operational intelligence for imports, compliance,
                audit activity, task escalation, recalls, hospice oversight, and
                dashboard health.
              </p>
            </div>
          </div>

          {clearJarvisMessages ? (
            <button
              type="button"
              onClick={clearJarvisMessages}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative grid min-h-[540px] gap-0 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-h-[440px] flex-col bg-black/20">
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
          >
            {visibleMessages.length > 0 ? (
              visibleMessages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200/20 bg-white/10 text-sky-100 shadow-[0_0_18px_rgba(186,230,253,0.22)]">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}

                    <div
                      className={`max-w-[82%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-lg ${
                        isUser
                          ? "rounded-br-md bg-gradient-to-br from-sky-100 to-sky-300 text-slate-950 shadow-[0_0_25px_rgba(186,230,253,0.18)]"
                          : "rounded-bl-md border border-white/10 bg-slate-950/80 text-slate-100 shadow-[0_0_25px_rgba(125,211,252,0.08)] backdrop-blur-xl"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {isUser ? (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-slate-300">
                        <UserRound className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-center">
                <div>
                  <Bot className="mx-auto h-9 w-9 text-slate-500" />
                  <p className="mt-3 text-sm font-semibold text-slate-300">
                    No messages yet.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Ask something useful before the spreadsheet gods start
                    collecting souls again.
                  </p>
                </div>
              </div>
            )}

            {jarvisLoading ? (
              <div className="flex justify-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200/20 bg-white/10 text-sky-100 shadow-[0_0_18px_rgba(186,230,253,0.22)]">
                  <Bot className="h-4 w-4" />
                </div>

                <div className="rounded-[1.35rem] rounded-bl-md border border-white/10 bg-slate-950/85 px-4 py-3 text-sm text-slate-300 shadow-[0_0_20px_rgba(186,230,253,0.25)]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-200" />
                    Jarvis is thinking...
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {jarvisErrorMessage ? (
            <div className="mx-5 mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {jarvisErrorMessage}
            </div>
          ) : null}
        </div>

        <aside className="border-t border-white/10 bg-slate-950/60 p-4 backdrop-blur-xl lg:border-l lg:border-t-0">
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Suggested Prompts
            </p>

            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setJarvisPrompt(prompt)}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-300 transition hover:border-sky-200/30 hover:bg-sky-100/10 hover:text-white hover:shadow-[0_0_18px_rgba(186,230,253,0.18)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <label
            htmlFor="jarvis-prompt"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-sky-100"
          >
            Message Jarvis
          </label>

          <textarea
            id="jarvis-prompt"
            value={jarvisPrompt}
            onChange={(event) => setJarvisPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: What command center issues need attention first?"
            className="min-h-[210px] w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-200/50 focus:ring-2 focus:ring-sky-100/20"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <p
              className={`text-xs ${
                remainingCharacters < 0 ? "text-red-300" : "text-slate-500"
              }`}
            >
              {remainingCharacters} characters left
            </p>

            <p className="text-xs text-slate-600">
              Enter sends. Shift+Enter breaks line.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAskJarvis}
            disabled={submitDisabled}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-sky-100 to-sky-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_35px_rgba(186,230,253,0.35)] transition hover:from-white hover:to-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {jarvisLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}

            {jarvisLoading ? "Sending..." : "Send Message"}
          </button>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Guardrails
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Keep prompts operational. Do not paste PHI unless your backend is
              explicitly built and approved for it. HIPAA paperwork remains a
              cursed national monument.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
