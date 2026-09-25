import { describe, expect, it, vi } from "vitest";

import {
  createScannerScanQueue,
  enqueueAndDrainScanQueue,
  ScannerScanQueueDrainError,
} from "./scanQueue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

describe("inventory scanner scan queue", () => {
  it("preserves completed scans in FIFO order while one scan is processing", async () => {
    const queue = createScannerScanQueue();
    const firstScan = deferred();
    const processed: string[] = [];

    const processScan = vi.fn(async (barcode: string) => {
      processed.push(barcode);

      if (barcode === "A") {
        await firstScan.promise;
      }
    });

    const firstDrain = enqueueAndDrainScanQueue(queue, "A", processScan);

    await vi.waitFor(() => {
      expect(processed).toEqual(["A"]);
    });

    await enqueueAndDrainScanQueue(queue, "B", processScan);
    await enqueueAndDrainScanQueue(queue, "C", processScan);

    expect(processed).toEqual(["A"]);

    firstScan.resolve();
    await firstDrain;

    expect(processed).toEqual(["A", "B", "C"]);
    expect(processScan).toHaveBeenCalledTimes(3);
  });

  it("preserves identical completed scans as separate receive intents", async () => {
    const queue = createScannerScanQueue();
    const firstScan = deferred();
    const processed: string[] = [];

    const processScan = vi.fn(async (barcode: string) => {
      processed.push(barcode);

      if (processed.length === 1) {
        await firstScan.promise;
      }
    });

    const firstDrain = enqueueAndDrainScanQueue(queue, "ABC123", processScan);

    await vi.waitFor(() => {
      expect(processed).toEqual(["ABC123"]);
    });

    await enqueueAndDrainScanQueue(queue, "ABC123", processScan);
    await enqueueAndDrainScanQueue(queue, "ABC123", processScan);

    firstScan.resolve();
    await firstDrain;

    expect(processed).toEqual(["ABC123", "ABC123", "ABC123"]);
    expect(processScan).toHaveBeenCalledTimes(3);
  });

  it("keeps draining scans queued behind a failing scan and surfaces the error", async () => {
    const queue = createScannerScanQueue();
    const firstScanStarted = deferred();
    const finishFirstScan = deferred();
    const processed: string[] = [];
    const failure = new Error("Scan A failed.");

    const processScan = vi.fn(async (barcode: string) => {
      processed.push(barcode);

      if (barcode === "A") {
        firstScanStarted.resolve();
        await finishFirstScan.promise;
        throw failure;
      }
    });

    const firstDrain = enqueueAndDrainScanQueue(queue, "A", processScan);

    await firstScanStarted.promise;

    await enqueueAndDrainScanQueue(queue, "B", processScan);
    await enqueueAndDrainScanQueue(queue, "C", processScan);

    expect(processed).toEqual(["A"]);
    expect(queue.items).toEqual(["B", "C"]);

    finishFirstScan.resolve();

    await expect(firstDrain).rejects.toBeInstanceOf(
      ScannerScanQueueDrainError,
    );

    expect(processed).toEqual(["A", "B", "C"]);
    expect(processScan).toHaveBeenCalledTimes(3);
    expect(queue.processing).toBe(false);
    expect(queue.items).toEqual([]);
  });

  it("reports failed scans in drain order and preserves the original errors", async () => {
    const queue = createScannerScanQueue();
    const processed: string[] = [];
    const firstFailure = new Error("Scan A failed.");
    const secondFailure = new Error("Scan C failed.");

    const processScan = vi.fn(async (barcode: string) => {
      processed.push(barcode);

      if (barcode === "A") {
        throw firstFailure;
      }

      if (barcode === "C") {
        throw secondFailure;
      }
    });

    const drain = enqueueAndDrainScanQueue(queue, "A", processScan);

    await enqueueAndDrainScanQueue(queue, "B", processScan);
    await enqueueAndDrainScanQueue(queue, "C", processScan);

    const surfaced = await drain.catch((error: unknown) => error);

    expect(surfaced).toBeInstanceOf(ScannerScanQueueDrainError);

    const drainError = surfaced as ScannerScanQueueDrainError;

    expect(drainError.failures.map((failure) => failure.barcode)).toEqual([
      "A",
      "C",
    ]);
    expect(drainError.failures[0].error).toBe(firstFailure);
    expect(drainError.failures[1].error).toBe(secondFailure);
    expect(drainError.firstFailure.barcode).toBe("A");
    expect(drainError.message).toContain("2 scans could not be processed");
    expect(processed).toEqual(["A", "B", "C"]);
    expect(queue.processing).toBe(false);
    expect(queue.items).toEqual([]);
  });
});
