import { describe, expect, it } from "vitest";

import { computeCreateRequestHash } from "./orderWorkflowService.js";

describe("computeCreateRequestHash", () => {
  const baseInput = {
    actorUid: "actor-001",
    action: "create",
    productId: "product-test",
    quantity: 3,
    patientName: "Alice Smith",
    patientAddress: "100 Main St",
    productType: "Wheelchair",
    purchaseCost: 250,
    barcode: "BC-001",
    phone: "555-0100",
    facilityName: "Facility A",
    notes: "Leave at door",
  };

  it("returns a 64-character hex SHA-256 hash", () => {
    const hash = computeCreateRequestHash(baseInput);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for identical input", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash(baseInput);
    expect(hash1).toBe(hash2);
  });

  it("changes when quantity changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, quantity: 5 });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when productId changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, productId: "product-other" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when patientAddress changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, patientAddress: "999 Changed St" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when purchaseCost changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, purchaseCost: 999 });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when notes change", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, notes: "Different notes" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when barcode changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, barcode: "BC-OTHER" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when phone changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, phone: "555-9999" });
    expect(hash1).not.toBe(hash2);
  });

  it("changes when facilityName changes", () => {
    const hash1 = computeCreateRequestHash(baseInput);
    const hash2 = computeCreateRequestHash({ ...baseInput, facilityName: "Other Facility" });
    expect(hash1).not.toBe(hash2);
  });

  it("does not contain raw patientName in the hash output", () => {
    const hash = computeCreateRequestHash(baseInput);
    expect(hash).not.toContain("Alice Smith");
  });

  it("does not contain raw patientAddress in the hash output", () => {
    const hash = computeCreateRequestHash(baseInput);
    expect(hash).not.toContain("100 Main St");
  });

  it("does not contain raw phone in the hash output", () => {
    const hash = computeCreateRequestHash(baseInput);
    expect(hash).not.toContain("555-0100");
  });

  it("does not contain raw notes in the hash output", () => {
    const hash = computeCreateRequestHash(baseInput);
    expect(hash).not.toContain("Leave at door");
  });

  it("normalizes undefined optional fields to empty/0 consistently", () => {
    const withUndefined = computeCreateRequestHash({
      actorUid: "actor-001",
      action: "create",
      productId: "product-test",
      quantity: 3,
      patientName: "Alice Smith",
    });

    const withEmpty = computeCreateRequestHash({
      actorUid: "actor-001",
      action: "create",
      productId: "product-test",
      quantity: 3,
      patientName: "Alice Smith",
      patientAddress: "",
      productType: "",
      purchaseCost: 0,
      barcode: "",
      phone: "",
      facilityName: "",
      notes: "",
    });

    expect(withUndefined).toBe(withEmpty);
  });
});