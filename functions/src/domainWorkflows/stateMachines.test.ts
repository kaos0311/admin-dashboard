import { describe, expect, it } from "vitest";

import {
  DELIVERY_LINE_TRANSITIONS,
  DELIVERY_SIGNATURE_TRANSITIONS,
  EQUIPMENT_ASSIGNMENT_TRANSITIONS,
  PATIENT_LIFECYCLE_TRANSITIONS,
  RENTAL_TRANSITIONS,
} from "./shared.js";

describe("domain workflow state machines", () => {
  it("allows delivery partial fulfillment but rejects completing unresolved lines", () => {
    expect(DELIVERY_LINE_TRANSITIONS.pending.has("loaded")).toBe(true);
    expect(DELIVERY_LINE_TRANSITIONS.loaded.has("partially_delivered")).toBe(true);
    expect(DELIVERY_LINE_TRANSITIONS.pending.has("delivered")).toBe(false);
  });

  it("allows rental checkout and return through the existing UI states", () => {
    expect(RENTAL_TRANSITIONS.draft.has("active")).toBe(true);
    expect(RENTAL_TRANSITIONS.available.has("checked_out")).toBe(true);
    expect(RENTAL_TRANSITIONS.checked_out.has("available")).toBe(true);
    expect(RENTAL_TRANSITIONS.retired.has("checked_out")).toBe(false);
  });

  it("allows patient equipment recovery without reopening closed assignments", () => {
    expect(EQUIPMENT_ASSIGNMENT_TRANSITIONS.active.has("recovered")).toBe(true);
    expect(EQUIPMENT_ASSIGNMENT_TRANSITIONS.lost.has("recovered")).toBe(true);
    expect(EQUIPMENT_ASSIGNMENT_TRANSITIONS.returned.has("active")).toBe(false);
  });

  it("allows one-way delivery signature finalization", () => {
    expect(DELIVERY_SIGNATURE_TRANSITIONS.unsigned.has("signed")).toBe(true);
    expect(DELIVERY_SIGNATURE_TRANSITIONS.pending.has("refused")).toBe(true);
    expect(DELIVERY_SIGNATURE_TRANSITIONS.signed.has("unsigned")).toBe(false);
  });

  it("keeps patient lifecycle transitions explicit", () => {
    expect(PATIENT_LIFECYCLE_TRANSITIONS.active.has("archived")).toBe(true);
    expect(PATIENT_LIFECYCLE_TRANSITIONS.archived.has("active")).toBe(true);
    expect(PATIENT_LIFECYCLE_TRANSITIONS.destroyed.has("active")).toBe(false);
  });
});
