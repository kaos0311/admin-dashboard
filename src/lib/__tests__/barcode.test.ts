import { describe, it, expect } from "vitest";
import {
  normalizeBarcode,
  parseBarcode,
  detectBarcodeType,
  isNumericBarcode,
} from "@/lib/barcode";

describe("normalizeBarcode", () => {
  it("trims whitespace", () => {
    expect(normalizeBarcode("  123456  ")).toBe("123456");
  });

  it("removes carriage returns and line feeds", () => {
    expect(normalizeBarcode("123456\r\n")).toBe("123456");
  });

  it("removes tab characters", () => {
    expect(normalizeBarcode("123\t456")).toBe("123456");
  });

  it("removes null characters", () => {
    expect(normalizeBarcode("123\x00456")).toBe("123456");
  });

  it("preserves leading zeroes", () => {
    expect(normalizeBarcode("0012345")).toBe("0012345");
  });

  it("rejects empty values", () => {
    expect(normalizeBarcode("")).toBe("");
    expect(normalizeBarcode("   ")).toBe("");
  });

  it("enforces maximum length", () => {
    const long = "A".repeat(200);
    expect(normalizeBarcode(long, { maxLength: 128 })).toBe("");
  });

  it("does not convert barcode to number", () => {
    const result = normalizeBarcode("0123456789012");
    expect(result).toBe("0123456789012");
    expect(typeof result).toBe("string");
  });

  it("supports alphanumeric codes (Code 39/128)", () => {
    expect(normalizeBarcode("ABC-123-XYZ")).toBe("ABC-123-XYZ");
    expect(normalizeBarcode("TEST123")).toBe("TEST123");
  });

  it("preserves hyphens and dots", () => {
    expect(normalizeBarcode("123-456-789")).toBe("123-456-789");
    expect(normalizeBarcode("12.345.67")).toBe("12.345.67");
  });

  it("handles scanner Enter suffix", () => {
    // The scanner appends \r after the barcode when Enter suffix is enabled
    const result = parseBarcode("00641416753115\r");
    expect(result.valid).toBe(true);
    expect(result.value).toBe("00641416753115");
    expect(result.rawValue).toBe("00641416753115\r");
  });

  it("handles scanner CR+LF suffix", () => {
    const result = parseBarcode("4901234567890\r\n");
    expect(result.valid).toBe(true);
    expect(result.value).toBe("4901234567890");
  });
});

describe("detectBarcodeType", () => {
  it("detects UPC-A (12 digits)", () => {
    expect(detectBarcodeType("012345678905")).toBe("UPC_A");
  });

  it("detects EAN-13 (13 digits)", () => {
    expect(detectBarcodeType("4901234567890")).toBe("EAN_13");
  });

  it("detects GTIN (14 digits)", () => {
    expect(detectBarcodeType("00012345678905")).toBe("GTIN");
  });

  it("detects EAN-8 (8 digits)", () => {
    expect(detectBarcodeType("12345670")).toBe("EAN_8");
  });

  it("detects UPC-E (6 digits)", () => {
    expect(detectBarcodeType("123456")).toBe("UPC_E");
  });

  it("detects Code 128 for alphanumeric <= 64 chars", () => {
    expect(detectBarcodeType("ABC-123")).toBe("CODE_128");
  });

  it("detects QR for long alphanumeric", () => {
    expect(detectBarcodeType("A".repeat(80))).toBe("QR");
  });
});

describe("isNumericBarcode", () => {
  it("returns true for all-digit barcodes", () => {
    expect(isNumericBarcode("123456")).toBe(true);
    expect(isNumericBarcode("0012345")).toBe(true);
  });

  it("returns false for alphanumeric barcodes", () => {
    expect(isNumericBarcode("ABC123")).toBe(false);
    expect(isNumericBarcode("123-ABC")).toBe(false);
  });
});

describe("parseBarcode", () => {
  it("returns structured result for valid barcode", () => {
    const result = parseBarcode("00641416753115\r");
    expect(result.valid).toBe(true);
    expect(result.value).toBe("00641416753115");
    expect(result.rawValue).toBe("00641416753115\r");
    expect(result.error).toBeUndefined();
  });

  it("returns error for empty barcode", () => {
    const result = parseBarcode("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Barcode is empty");
  });

  it("returns error for too-long barcode", () => {
    const long = "A".repeat(200);
    const result = parseBarcode(long, { maxLength: 50 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum length");
  });
});
