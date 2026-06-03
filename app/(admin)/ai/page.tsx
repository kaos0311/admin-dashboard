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

import {
  alerts,
  badges,
  buttons,
  colors,
  forms,
  glass,
  spacing,
  typography,
} from "@/theme";
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
      toast.error(`Question exceeds ${MAX_PROMPT_LENGTH} character limit.`);
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
          ? "OpenAI billing or quota issue."
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
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <section className={[glass.panel, spacing.section].join(" ")}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", badges.neutral].join(" ")}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Stark Command Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Admin AI Command Center
                </h1>

                <p className={["mt-3 max-w-3xl", typography.body].join(" ")}>
                  Operational AI for imports, audit activity, compliance risk,
                  hospice oversight, report health, recalls, WIP bottlenecks,
                  and system diagnostics. Because staring at spreadsheets until
                  your soul leaves your body is apparently still considered
                  workflow.
                </p>
              </div>
            </div>

            <div className={`${glass.cardPadded} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className={glass.iconBox}>
                  <Bot className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className={typography.bodyStrong}>
                      Jarvis Online
                    </p>

                    <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", badges.active].join(" ")}>
                      <span className={["h-2 w-2 animate-pulse rounded-full", colors.pulse].join(" ")} />
                      Active
                    </span>
                  </div>

                  <p className={["mt-1", typography.smallMuted].join(" ")}>
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

                  <p className={["mt-2", typography.bodyMuted].join(" ")}>
                    Use Ctrl/⌘ + Enter to send.
                  </p>
                </div>

                <div
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium",
                    remainingCharacters < 0
                      ? colors.dangerBadge
                      : badges.neutral,
                  ].join(" ")}
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
                    className={["rounded-xl px-3 py-2 text-xs transition", badges.neutral, colors.surfaceHover].join(" ")}
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
                className={["min-h-[260px] resize-none", forms.textarea].join(" ")}
              />

              {errorMessage ? (
                <div className={["mt-4 flex gap-3", alerts.danger].join(" ")}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <p className={["max-w-2xl", typography.smallMuted].join(" ")}>
                  Keep prompts operational. Avoid PHI unless your
                  infrastructure is explicitly configured for compliant
                  handling. Lawyers travel in packs and feed on weak
                  documentation.
                </p>

                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={!canSubmit}
                  className={buttons.primary}
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
                <div className={glass.iconBox}>
                  <Sparkles className="h-4 w-4" />
                </div>

                <div>
                  <p className={typography.caption}>
                    AI Response
                  </p>

                  <p className={typography.bodyMuted}>
                    Operational analysis from Jarvis
                  </p>
                </div>
              </div>

              {loading ? (
                <div className={["flex min-h-[420px] items-center justify-center p-6", glass.insetPadded].join(" ")}>
                  <div className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />

                    <p className={["mt-4", typography.bodyMuted].join(" ")}>
                      Running operational analysis...
                    </p>
                  </div>
                </div>
              ) : answer ? (
                <div className={["max-h-[760px] overflow-auto whitespace-pre-wrap p-5", glass.insetPadded, typography.bodyStrong].join(" ")}>
                  {answer}
                </div>
              ) : (
                <div className={["flex min-h-[420px] items-center justify-center p-6 text-center", glass.emptyState].join(" ")}>
                  <div>
                    <Bot className={["mx-auto h-8 w-8", colors.textFaint].join(" ")} />

                    <p className={["mt-4", typography.bodyStrong].join(" ")}>
                      Awaiting operational query
                    </p>

                    <p className={["mt-2", typography.smallMuted].join(" ")}>
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
