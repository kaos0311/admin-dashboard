import { describe, expect, it } from "vitest";

import { shouldSuppressDuplicateScan } from "./useBarcodeScanner";

describe("shouldSuppressDuplicateScan", () => {
  it("does not treat repeated barcode values as duplicates when suppression is disabled", () => {
    expect(
      shouldSuppressDuplicateScan({
        normalizedValue: "ABC123",
        lastValue: "ABC123",
        now: 1_100,
        lastAcceptedAt: 1_000,
        duplicateSuppressionMs: 0,
      }),
    ).toBe(false);
  });

  it("can still suppress a narrow hardware bounce window when explicitly configured", () => {
    expect(
      shouldSuppressDuplicateScan({
        normalizedValue: "ABC123",
        lastValue: "ABC123",
        now: 1_025,
        lastAcceptedAt: 1_000,
        duplicateSuppressionMs: 50,
      }),
    ).toBe(true);
  });
});
