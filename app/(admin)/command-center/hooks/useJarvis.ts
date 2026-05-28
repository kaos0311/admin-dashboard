"use client";

import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

import { auth, db, functions } from "@/lib/firebase";

export type JarvisMessageRole = "user" | "assistant";

export type JarvisMessage = {
  id: string;
  role: JarvisMessageRole;
  content: string;
  createdAt: number;
};

type UseJarvisOptions = {
  commandContext?: unknown;
};

type AskAdminAiRequest = {
  prompt: string;
};

type AskAdminAiResponse = {
  answer?: string;
};

const MAX_PROMPT_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;

const askAdminAi = httpsCallable<AskAdminAiRequest, AskAdminAiResponse>(
  functions,
  "askAdminAi"
);

function createId(): string {
  return crypto.randomUUID();
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, 6000);
  } catch {
    return "Context unavailable.";
  }
}

function buildJarvisPrompt(params: {
  userPrompt: string;
  history: JarvisMessage[];
  commandContext?: unknown;
}) {
  const historyText = params.history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      const label = message.role === "user" ? "User" : "Jarvis";
      return `${label}: ${message.content}`;
    })
    .join("\n\n");

  return [
    "You are Jarvis inside the Advanced Home Medical Command Center.",
    "You help with imports, compliance issues, task escalation, hospice oversight, recalls, audit activity, WIP bottlenecks, and dashboard health.",
    "Do not invent data. If information is missing, say what is missing.",
    "Do not expose PHI unless it was explicitly provided in the safe operational context.",
    "Be direct, operational, and useful.",
    "",
    "CURRENT SAFE COMMAND CENTER CONTEXT:",
    compactJson(params.commandContext ?? {}),
    "",
    historyText ? `RECENT CHAT HISTORY:\n${historyText}` : "",
    "",
    `CURRENT USER QUESTION:\n${params.userPrompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function useJarvis(options: UseJarvisOptions = {}) {
  const [jarvisPrompt, setJarvisPrompt] = useState("");
  const [jarvisAnswer, setJarvisAnswer] = useState("");
  const [jarvisLoading, setJarvisLoading] = useState(false);
  const [jarvisErrorMessage, setJarvisErrorMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [jarvisMessages, setJarvisMessages] = useState<JarvisMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content:
        "Jarvis online. Ask me what needs attention, what looks risky, or what operational fire needs stomping out first.",
      createdAt: Date.now(),
    },
  ]);

  const cleanPrompt = useMemo(() => jarvisPrompt.trim(), [jarvisPrompt]);
  const remainingCharacters = MAX_PROMPT_LENGTH - jarvisPrompt.length;

  const canAskJarvis =
    cleanPrompt.length > 0 &&
    jarvisPrompt.length <= MAX_PROMPT_LENGTH &&
    !jarvisLoading;

  async function ensureConversation(): Promise<string | null> {
    const user = auth.currentUser;

    if (!user) return null;

    if (conversationId) return conversationId;

    const conversationRef = doc(collection(db, "aiConversations"));

    await setDoc(conversationRef, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      title: "Command Center Chat",
      source: "command-center",
    });

    setConversationId(conversationRef.id);

    return conversationRef.id;
  }

  async function persistMessage(message: JarvisMessage) {
    const user = auth.currentUser;
    if (!user) return;

    const activeConversationId = await ensureConversation();
    if (!activeConversationId) return;

    await addDoc(
      collection(db, "aiConversations", activeConversationId, "messages"),
      {
        role: message.role,
        content: message.content,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      }
    );

    await setDoc(
      doc(db, "aiConversations", activeConversationId),
      {
        updatedAt: serverTimestamp(),
        lastMessagePreview: message.content.slice(0, 180),
      },
      { merge: true }
    );
  }

  async function handleAskJarvis(promptOverride?: string) {
    const rawPrompt = (promptOverride ?? jarvisPrompt).trim();

    if (!rawPrompt) {
      toast.error("Ask Jarvis something first.");
      return;
    }

    if (rawPrompt.length > MAX_PROMPT_LENGTH) {
      toast.error(`Prompt is too long. Limit is ${MAX_PROMPT_LENGTH} characters.`);
      return;
    }

    const userMessage: JarvisMessage = {
      id: createId(),
      role: "user",
      content: rawPrompt,
      createdAt: Date.now(),
    };

    const nextMessages = [...jarvisMessages, userMessage];

    setJarvisMessages(nextMessages);
    setJarvisPrompt("");
    setJarvisAnswer("");
    setJarvisErrorMessage("");
    setJarvisLoading(true);

    void persistMessage(userMessage).catch((error) => {
      console.error("JARVIS USER MESSAGE PERSIST ERROR:", error);
    });

    try {
      const prompt = buildJarvisPrompt({
        userPrompt: rawPrompt,
        history: jarvisMessages,
        commandContext: options.commandContext,
      });

      const result = await askAdminAi({ prompt });

      const answer =
        result.data?.answer?.trim() ||
        "Jarvis returned an empty response. Very helpful. Very machine-like.";

      const assistantMessage: JarvisMessage = {
        id: createId(),
        role: "assistant",
        content: answer,
        createdAt: Date.now(),
      };

      setJarvisAnswer(answer);
      setJarvisMessages((current) => [...current, assistantMessage]);

      void persistMessage(assistantMessage).catch((error) => {
        console.error("JARVIS ASSISTANT MESSAGE PERSIST ERROR:", error);
      });
    } catch (error) {
      console.error("JARVIS REQUEST ERROR:", error);

      const message =
        error instanceof Error ? error.message : "Jarvis request failed.";

      setJarvisErrorMessage(message);
      toast.error("Jarvis request failed.");

      setJarvisMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content:
            "I could not complete that request. Check the callable logs, auth, App Check, and OpenAI secret. The usual digital dumpster fire checklist.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setJarvisLoading(false);
    }
  }

  function clearJarvisMessages() {
    setJarvisAnswer("");
    setJarvisErrorMessage("");
    setJarvisPrompt("");
    setConversationId(null);
    setJarvisMessages([
      {
        id: createId(),
        role: "assistant",
        content: "Conversation cleared. Jarvis online.",
        createdAt: Date.now(),
      },
    ]);
  }

  return {
    jarvisPrompt,
    setJarvisPrompt,
    jarvisAnswer,
    jarvisLoading,
    jarvisMessages,
    jarvisErrorMessage,
    remainingCharacters,
    canAskJarvis,
    handleAskJarvis,
    clearJarvisMessages,
  };
}
