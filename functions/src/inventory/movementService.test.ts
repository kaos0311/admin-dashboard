import { describe, expect, it } from "vitest";

import { normalizeScanValue } from "./movementService.js";

describe("inventory movement scan safety", () => {
  it("accepts UPC, EAN, internal barcode, serial, manufacturer ID, and product-like IDs", () => {
    expect(normalizeScanValue("0012345678905").value).toBe("0012345678905");
    expect(normalizeScanValue("ABC-128-XYZ").value).toBe("ABC-128-XYZ");
    expect(normalizeScanValue("SN123456").value).toBe("SN123456");
    expect(normalizeScanValue("MFG-9981").value).toBe("MFG-9981");
    expect(normalizeScanValue("product_123").value).toBe("product_123");
  });

  it("rejects URL QR codes before Firestore path construction", () => {
    const result = normalizeScanValue("https://example.com/products/123");

    expect(result.status).toBe("invalid");
    expect(result.error).toContain("URL QR codes");
  });

  it("rejects path-like values", () => {
    const result = normalizeScanValue("../products/abc");

    expect(result.status).toBe("invalid");
    expect(result.error).toContain("path");
  });

  it("strips scanner suffix characters without changing leading zeroes", () => {
    const result = normalizeScanValue("0012345678905\r\n");

    expect(result.status).toBe("valid");
    expect(result.value).toBe("0012345678905");
  });
});
