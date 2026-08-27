/**
 * OpenAI client factory.
 * Previously an empty scaffold.
 *
 * Centralizes model/temperature configuration and the web-search tool block
 * so askAdminAi.ts can delegate construction. Keeps the Responses-API shape
 * identical to current production usage.
 */

import OpenAI from "openai";

export const JARVIS_MODEL = "gpt-4.1-mini";
export const JARVIS_TEMPERATURE = 0.25;

export interface JarvisResponsesInput
  extends Partial<Pick<OpenAI.Responses.ResponseCreateParams, "tools" | "tool_choice">> {
  system: string;
  user: string;
}

export function createOpenAiClient(apiKey: string): OpenAI {
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY secret is not configured for this deployment."
    );
  }
  return new OpenAI({ apiKey });
}

export function buildJarvisResponsesParams(input: JarvisResponsesInput): OpenAI.Responses.ResponseCreateParams {
  return {
    model: JARVIS_MODEL,
    temperature: JARVIS_TEMPERATURE,
    tools: input.tools,
    tool_choice: input.tool_choice,
    input: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  };
}

export type { OpenAI };