/**
 * Input validation helpers for AI callables.
 * Previously an empty scaffold.
 */

export function isValidPrompt(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function assertValidPrompt(value: unknown): asserts value is string {
  if (!isValidPrompt(value)) {
    throw new Error(
      "Invalid request: 'prompt' must be a non-empty string."
    );
  }
}