export type ScannerScanQueue = {
  items: string[];
  processing: boolean;
};

/**
 * A completed physical scan event whose processor failed.
 *
 * The scan has already been dequeued, so it is never replayed: the failure is
 * reported instead of being silently dropped.
 */
export type ScannerScanFailure = {
  barcode: string;
  error: unknown;
};

function describeScannerScanFailure(failure: ScannerScanFailure): string {
  const detail =
    failure.error instanceof Error
      ? failure.error.message
      : String(failure.error);

  return `"${failure.barcode}": ${detail}`;
}

function buildScannerScanQueueDrainMessage(
  failures: ScannerScanFailure[],
): string {
  const [firstFailure] = failures;

  if (firstFailure === undefined) {
    return "A scanned barcode could not be processed.";
  }

  if (failures.length === 1) {
    return `Scan ${describeScannerScanFailure(firstFailure)} could not be processed.`;
  }

  return `${failures.length} scans could not be processed. First: scan ${describeScannerScanFailure(firstFailure)}.`;
}

/**
 * Aggregate failure report for a single drain.
 *
 * Thrown by the drain owner once the queue is empty, so every completed scan
 * event reaches a deliberate terminal outcome and scans queued behind a
 * failing scan are never stranded.
 */
export class ScannerScanQueueDrainError extends Error {
  readonly failures: ScannerScanFailure[];

  constructor(failures: ScannerScanFailure[]) {
    super(buildScannerScanQueueDrainMessage(failures));
    this.name = "ScannerScanQueueDrainError";
    this.failures = failures;
  }

  /** The failure belonging to the earliest scan in drain order. */
  get firstFailure(): ScannerScanFailure {
    return this.failures[0];
  }
}

export function createScannerScanQueue(): ScannerScanQueue {
  return {
    items: [],
    processing: false,
  };
}

/**
 * Enqueue a completed physical scan event and drain the queue in FIFO order.
 *
 * Exactly one caller owns the drain. Processors never run concurrently: each
 * scan is awaited before the next one starts.
 *
 * A processor failure ends that scan's attempt only. The remaining queued scan
 * events still run, and the failures are aggregated into a
 * {@link ScannerScanQueueDrainError} thrown by the owning caller after the
 * queue is drained. Non-owning callers resolve immediately: their scan is
 * reported by the drain owner.
 */
export async function enqueueAndDrainScanQueue(
  queue: ScannerScanQueue,
  barcode: string,
  processScan: (barcode: string) => Promise<void>,
): Promise<void> {
  queue.items.push(barcode);

  if (queue.processing) {
    return;
  }

  queue.processing = true;

  const failures: ScannerScanFailure[] = [];

  try {
    while (queue.items.length > 0) {
      const nextBarcode = queue.items.shift();

      if (nextBarcode === undefined) {
        continue;
      }

      try {
        await processScan(nextBarcode);
      } catch (error: unknown) {
        // Keep draining. The scans already queued behind this one are
        // completed physical scan events and must reach a terminal outcome
        // too, rather than being left queued with no drain owner.
        failures.push({ barcode: nextBarcode, error });
      }
    }
  } finally {
    queue.processing = false;
  }

  if (failures.length > 0) {
    throw new ScannerScanQueueDrainError(failures);
  }
}
