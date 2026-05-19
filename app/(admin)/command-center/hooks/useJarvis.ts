"use client";

import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

const functions = getFunctions(undefined, "us-central1");

const askAdminAi = httpsCallable<{ prompt: string }, { answer: string }>(
  functions,
  "askAdminAi"
);

export function useJarvis() {
  const [jarvisPrompt, setJarvisPrompt] = useState("");
  const [jarvisAnswer, setJarvisAnswer] = useState("");
  const [jarvisLoading, setJarvisLoading] = useState(false);

  async function handleAskJarvis() {
    const cleanPrompt = jarvisPrompt.trim();

    if (!cleanPrompt) {
      toast.error("Ask Jarvis something first.");
      return;
    }

    setJarvisLoading(true);
    setJarvisAnswer("");

    try {
      const result = await askAdminAi({
        prompt: `You are Jarvis inside the Command Center. Focus on command center operations, compliance issues, task escalation, hospice oversight, recalls, audit activity, imports, and dashboard health. User question: ${cleanPrompt}`,
      });

      setJarvisAnswer(result.data.answer);
    } catch (error) {
      console.error("JARVIS REQUEST ERROR:", error);
      toast.error("Jarvis request failed.");
    } finally {
      setJarvisLoading(false);
    }
  }

  return {
    jarvisPrompt,
    setJarvisPrompt,
    jarvisAnswer,
    jarvisLoading,
    handleAskJarvis,
  };
}