import pLimit from "p-limit";

export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  const safeConcurrency = Math.max(1, Math.min(Math.floor(concurrency), 25));
  const limit = pLimit(safeConcurrency);

  await Promise.all(
    items.map((item, index) =>
      limit(async () => {
        await task(item, index);
      })
    )
  );
}
