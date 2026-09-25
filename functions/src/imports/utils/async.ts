export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function jitter(maxMs = 500): number {
  return Math.floor(Math.random() * maxMs);
}

export function isRetryableFirestoreError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;

  return (
    code === 4 || // DEADLINE_EXCEEDED
    code === 8 || // RESOURCE_EXHAUSTED
    code === 10 || // ABORTED
    code === 13 || // INTERNAL
    code === 14 // UNAVAILABLE
  );
}

export async function retryWithBackoff<T>(
  task: () => Promise<T>,
  options?: {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    label?: string;
  }
): Promise<T> {
  const retries = options?.retries ?? 6;
  const baseDelayMs = options?.baseDelayMs ?? 750;
  const maxDelayMs = options?.maxDelayMs ?? 30_000;

  let attempt = 0;

  while (true) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;

      if (!isRetryableFirestoreError(error) || attempt > retries) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs) + jitter();

      console.warn("Retrying Firestore operation", {
        label: options?.label ?? "firestore-operation",
        attempt,
        delay,
        code: (error as { code?: unknown })?.code,
        message: (error as { message?: unknown })?.message,
      });

      await sleep(delay);
    }
  }
}
