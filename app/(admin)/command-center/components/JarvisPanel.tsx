"use client";

import { useEffect, useRef } from "react";
import {
  ClipboardCheck,
  FileSearch,
  Loader2,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";

import {
  alerts,
  badges,
  buttons,
  colors,
  forms,
  glass,
  typography,
} from "@/theme";

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
  handleAskJarvis: (promptOverride?: string) => void;
  clearJarvisMessages?: () => void;
};

const QUICK_ACTIONS = [
  {
    label: "Analyze Latest Import",
    icon: FileSearch,
    prompt:
      "Analyze the latest import. Summarize issues, chunks, warnings, failed rows, stuck work, and recommended next actions.",
  },
  {
    label: "Find Stuck Work",
    icon: Wrench,
    prompt:
      "Find stuck or stalled work across imports, importQueue, tasks, WIP records, CMN queue, and PAR alerts. Prioritize urgent items.",
  },
  {
    label: "Compliance Risk",
    icon: ShieldAlert,
    prompt:
      "Summarize current compliance risks across CMN queue, PAR alerts, recalls, hospice oversight, audit logs, and open tasks.",
  },
  {
    label: "Daily Ops Brief",
    icon: ClipboardCheck,
    prompt:
      "Give me a concise command center operations brief. Include imports, issues, tasks, CMNs, PAR alerts, recalls, hospice oversight, and next actions.",
  },
];

const SUGGESTED_PROMPTS = [
  "What needs immediate attention?",
  "What were the latest import issues?",
  "Which queues look risky?",
  "What should I fix first?",
];

function JarvisCoreIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const outerSize = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const ringSize = size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const innerSize = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const boltSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <div
      className={[
        "relative flex shrink-0 items-center justify-center rounded-2xl",
        outerSize,
        colors.infoBadge,
        "shadow-lg",
      ].join(" ")}
      aria-hidden="true"
    >
      <div
        className={[
          "absolute rounded-full",
          ringSize,
          "border border-cyan-200/40 bg-cyan-300/10",
        ].join(" ")}
      />
      <div className="absolute h-full w-full rounded-2xl bg-cyan-300/5 blur-md" />

      <div
        className={[
          innerSize,
          "rounded-full",
          colors.pulse,
        ].join(" ")}
      />

      <Zap className={["absolute", boltSize, colors.textInverse].join(" ")} />
    </div>
  );
}

export function JarvisPanel({
  jarvisPrompt,
  jarvisAnswer,
  jarvisLoading,
  jarvisMessages = [],
  jarvisErrorMessage = "",
  remainingCharacters = 8000 - jarvisPrompt.length,
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

  function sendQuickPrompt(prompt: string) {
    if (jarvisLoading) return;
    handleAskJarvis(prompt);
  }

  return (
    <section
      className={[
        "relative mx-auto w-full max-w-5xl min-w-0 overflow-hidden rounded-[1.75rem]",
        glass.panel,
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:34px_34px]"
      />

      <header className={["relative px-4 py-3 sm:px-5", colors.border, "border-b"].join(" ")}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <JarvisCoreIcon />

            <div className="min-w-0">
              <h2 className={["flex min-w-0 flex-wrap items-center gap-2", typography.cardTitle].join(" ")}>
                <span className="min-w-0 break-words">Jarvis</span>

                <Sparkles className="h-4 w-4 shrink-0" />

                <span
                  className={[
                    "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-wider",
                    badges.active,
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2 w-2 shrink-0 rounded-full",
                      colors.pulse,
                    ].join(" ")}
                  />
                  Core Online
                </span>
              </h2>

              <p className={["mt-1 max-w-2xl break-words", typography.small].join(" ")}>
                Database-aware Stark-style operations intelligence for imports,
                queues, compliance, recalls, hospice oversight, audit activity,
                and dashboard health.
              </p>
            </div>
          </div>

          {clearJarvisMessages ? (
            <button
              type="button"
              onClick={clearJarvisMessages}
              className={buttons.compactSecondary}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
      </header>

      <div className={["relative flex h-[520px] min-w-0 flex-col", colors.surfaceInset].join(" ")}>
        <div className={["px-4 py-3 sm:px-5", colors.border, colors.overlay, "border-b"].join(" ")}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  disabled={jarvisLoading}
                  onClick={() => sendQuickPrompt(action.prompt)}
                  className={["min-w-0", buttons.compactSecondary].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
        >
          {visibleMessages.length > 0 ? (
            visibleMessages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={[
                    "flex min-w-0 gap-2",
                    isUser ? "justify-end" : "justify-start",
                  ].join(" ")}
                >
                  {!isUser ? <JarvisCoreIcon size="sm" /> : null}

                  <div
                    className={[
                      "min-w-0 max-w-[86%] break-words rounded-[1.25rem] px-4 py-2.5 text-sm leading-6 shadow-sm sm:max-w-[72%]",
                      isUser
                        ? ["rounded-br-md", colors.infoBadge].join(" ")
                        : ["rounded-bl-md", glass.insetPadded, typography.bodyStrong].join(" "),
                    ].join(" ")}
                  >
                    <p className="min-w-0 whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>

                  {isUser ? (
                    <div className={["mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", badges.neutral].join(" ")}>
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className={["flex h-full min-h-[260px] items-center justify-center rounded-3xl p-6 text-center", glass.emptyState].join(" ")}>
              <div className="min-w-0">
                <div className="mx-auto flex justify-center">
                  <JarvisCoreIcon />
                </div>

                <p className={["mt-3", typography.bodyStrong].join(" ")}>
                  Jarvis core standing by.
                </p>

                <p className={["mt-1 max-w-md", typography.smallMuted].join(" ")}>
                  Ask something useful before the spreadsheet gods start
                  collecting souls again.
                </p>
              </div>
            </div>
          )}

          {jarvisLoading ? (
            <div className="flex min-w-0 justify-start gap-2">
              <JarvisCoreIcon size="sm" />

              <div className={["min-w-0 rounded-[1.25rem] rounded-bl-md px-4 py-3", glass.inset, typography.bodyMuted].join(" ")}>
                <div className="flex min-w-0 items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="min-w-0 break-words">
                    Jarvis is checking the database...
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {jarvisErrorMessage ? (
          <div className={["mx-4 mb-3 px-4 py-3 sm:mx-5", alerts.danger].join(" ")}>
            {jarvisErrorMessage}
          </div>
        ) : null}

        <div className={["px-4 py-3 backdrop-blur-xl sm:px-5", colors.border, colors.overlay, "border-t"].join(" ")}>
          <div className="mb-2 flex min-w-0 flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={jarvisLoading}
                onClick={() => setJarvisPrompt(prompt)}
                className={["rounded-full px-3 py-1 text-xs leading-5", badges.neutral, colors.surfaceHover].join(" ")}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 items-end gap-3">
            <label htmlFor="jarvis-prompt" className="sr-only">
              Message Jarvis
            </label>

            <textarea
              id="jarvis-prompt"
              value={jarvisPrompt}
              onChange={(event) => setJarvisPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Message Jarvis..."
              className={["max-h-32 min-h-[46px] flex-1 resize-none rounded-3xl", forms.input].join(" ")}
            />

            <button
              type="button"
              onClick={() => handleAskJarvis()}
              disabled={submitDisabled}
              aria-label={jarvisLoading ? "Sending message" : "Send message"}
              className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-full", buttons.info].join(" ")}
            >
              {jarvisLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="mt-1.5 flex min-w-0 flex-col gap-1 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className={remainingCharacters < 0 ? colors.dangerBadge : colors.textFaint}>
              {remainingCharacters} characters left
            </p>

            <p className={colors.textFaint}>
              Enter sends. Shift+Enter starts a new line.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


