import OpenAI from "openai";

import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const openAiApiKey = defineSecret("OPENAI_API_KEY");

type AskAdminAiRequest = {
  prompt?: string;
};

type AskAdminAiResponse = {
  answer: string;
};

export const askAdminAi = onCall<AskAdminAiRequest, Promise<AskAdminAiResponse>>(
  {
    cors: true,
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const prompt = request.data?.prompt?.trim();

    if (!prompt) {
      throw new HttpsError("invalid-argument", "Prompt is required.");
    }

    if (prompt.length > 4000) {
      throw new HttpsError("invalid-argument", "Prompt exceeds maximum length.");
    }

    const apiKey = openAiApiKey.value();

    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Missing OPENAI_API_KEY.");
    }

    const openai = new OpenAI({
      apiKey,
    });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: [
              "You are Jarvis, the operational AI assistant for the Advanced Home Medical Command Center.",
              "Focus on imports, compliance issues, task escalation, hospice oversight, recalls, audit activity, reporting, and dashboard health.",
              "Never invent patient data, counts, names, dates, or metrics.",
              "If information is missing, say what is missing.",
              "Keep answers clear, concise, and operational.",
            ].join(" "),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      return {
        answer:
          completion.choices[0]?.message?.content?.trim() ||
          "No response generated.",
      };
    } catch (error) {
      console.error("ASK ADMIN AI ERROR:", error);
      throw new HttpsError("internal", "AI request failed.");
    }
  }
);