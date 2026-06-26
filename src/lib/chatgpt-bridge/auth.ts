/**
 * Simple API-key-based auth for the ChatGPT GPT Actions bridge.
 * The shared key must be set as CHATGPT_API_KEY in the environment.
 */

export function verifyChatGptApiKey(authorizationHeader: string | null): {
  ok: boolean;
  error?: string;
} {
  if (!authorizationHeader) {
    return { ok: false, error: "Missing Authorization header" };
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { ok: false, error: "Missing API key in Authorization header" };
  }

  const expectedKey = process.env.CHATGPT_API_KEY;
  if (!expectedKey) {
    return {
      ok: false,
      error:
        "CHATGPT_API_KEY is not configured on the server. Ask an admin to set this environment variable.",
    };
  }

  if (token !== expectedKey) {
    return { ok: false, error: "Invalid API key" };
  }

  return { ok: true };
}
