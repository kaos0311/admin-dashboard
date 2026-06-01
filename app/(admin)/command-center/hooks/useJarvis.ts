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

type AskAdminAiRequest = {
  prompt: string;
};

type AskAdminAiResponse = {
  answer?: string;
  contextUsed?: {
    imports: number;
    issues: number;
    tasks: number;
    recalls: number;
    hospice: number;
    auditLogs: number;
    reports: number;
  };
};

const MAX_PROMPT_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 10;

const askAdminAi = httpsCallable<AskAdminAiRequest, AskAdminAiResponse>(
  functions,
  "askAdminAi"
);

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildJarvisPrompt(params: {
  userPrompt: string;
  history: JarvisMessage[];
}) {
  const historyText = params.history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      const label = message.role === "user" ? "User" : "Jarvis";
      return `${label}: ${message.content}`;
    })
    .join("\n\n");

  return [
    historyText ? `RECENT CHAT HISTORY:\n${historyText}` : "",
    "",
    `CURRENT USER QUESTION:\n${params.userPrompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function useJarvis() {
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

    setJarvisMessages((current) => [...current, userMessage]);
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
      });

      const result = await askAdminAi({ prompt });

      const answer =
        result.data?.answer?.trim() ||
        "Jarvis returned an empty response. Somehow the machine found a way to shrug.";

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
            "I could not complete that request. Check the callable logs, auth, App Check, OpenAI secret, and Firestore permissions. The usual digital dumpster fire checklist.",
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


