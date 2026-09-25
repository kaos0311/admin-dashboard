import { describe, expect, it } from "vitest";

import { normalizeBarcode, parseBarcode } from "@/lib/barcode";

describe("barcode safety", () => {
  it("rejects URL QR codes", () => {
    const parsed = parseBarcode("https://example.com/item/123");

    expect(parsed.valid).toBe(false);
    expect(normalizeBarcode("https://example.com/item/123")).toBe("");
  });

  it("rejects values that could become Firestore paths", () => {
    expect(parseBarcode("products/abc").valid).toBe(false);
    expect(parseBarcode("..").valid).toBe(false);
  });

  it("preserves valid leading-zero barcodes", () => {
    expect(normalizeBarcode("0012345678905\r\n")).toBe("0012345678905");
  });
});
