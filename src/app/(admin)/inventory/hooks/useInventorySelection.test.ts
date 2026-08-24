import { describe, expect, it } from "vitest";

import { reconcileSelectedInventoryIds } from "./useInventorySelection";

const item = (id: string) => ({ id });

describe("inventory selection reconciliation", () => {
  it("removes IDs that disappeared from realtime inventory", () => {
    expect(
      reconcileSelectedInventoryIds(
        ["a", "missing", "b"],
        [item("a"), item("b")],
        [item("a"), item("b")],
        true,
      ),
    ).toEqual(["a", "b"]);
  });

  it("removes selected IDs hidden by the current filters", () => {
    expect(
      reconcileSelectedInventoryIds(
        ["a", "b", "c"],
        [item("a"), item("b"), item("c")],
        [item("a"), item("c")],
        true,
      ),
    ).toEqual(["a", "c"]);
  });

  it("clears selection when write permission is unavailable", () => {
    expect(
      reconcileSelectedInventoryIds(
        ["a", "b"],
        [item("a"), item("b")],
        [item("a"), item("b")],
        false,
      ),
    ).toEqual([]);
  });

  it("removes duplicate selected IDs while preserving order", () => {
    expect(
      reconcileSelectedInventoryIds(
        ["b", "a", "b", "a"],
        [item("a"), item("b")],
        [item("a"), item("b")],
        true,
      ),
    ).toEqual(["b", "a"]);
  });

  it("keeps only IDs that are both valid and visible", () => {
    expect(
      reconcileSelectedInventoryIds(
        ["visible", "hidden", "missing"],
        [
          item("visible"),
          item("hidden"),
        ],
        [item("visible")],
        true,
      ),
    ).toEqual(["visible"]);
  });
});
