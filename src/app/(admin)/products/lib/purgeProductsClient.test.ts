import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  executePurgeProducts,
  PURGE_PRODUCTS_CONFIRM_TEXT,
  type PurgeProductsCallable,
} from "./purgeProductsClient";

describe("purgeProducts client contract", () => {
  it("forwards the exact typed confirmation and returns the server result", async () => {
    const callable = vi.fn(async () => ({
      data: {
        status: "success" as const,
        deletedCount: 850,
      },
    })) as PurgeProductsCallable;

    const result = await executePurgeProducts(
      callable,
      PURGE_PRODUCTS_CONFIRM_TEXT,
    );

    expect(callable).toHaveBeenCalledTimes(1);
    expect(callable).toHaveBeenCalledWith({
      confirmText: "PURGE PRODUCTS",
    });

    expect(result).toEqual({
      status: "success",
      deletedCount: 850,
    });
  });

  it("preserves a zero deletedCount from the server", async () => {
    const callable = vi.fn(async () => ({
      data: {
        status: "success" as const,
        deletedCount: 0,
      },
    })) as PurgeProductsCallable;

    await expect(
      executePurgeProducts(
        callable,
        PURGE_PRODUCTS_CONFIRM_TEXT,
      ),
    ).resolves.toEqual({
      status: "success",
      deletedCount: 0,
    });
  });

  it("propagates callable failures without reporting local success", async () => {
    const callable = vi.fn(async () => {
      throw new Error("server purge failed");
    }) as PurgeProductsCallable;

    await expect(
      executePurgeProducts(
        callable,
        PURGE_PRODUCTS_CONFIRM_TEXT,
      ),
    ).rejects.toThrow("server purge failed");
  });
});

describe("products purge integration wiring", () => {
  const repoRoot = path.resolve(__dirname, "../../../../..");

  it("uses the server callable and leaves no client hard-delete fallback", () => {
    const hook = fs.readFileSync(
      path.join(repoRoot, "src/app/(admin)/products/hooks/useProducts.ts"),
      "utf8",
    );

    const repository = fs.readFileSync(
      path.join(repoRoot, "src/repositories/firestore/product.repository.ts"),
      "utf8",
    );

    expect(hook).toContain('"purgeProducts"');
    expect(hook).toContain("executePurgeProducts");
    expect(hook).not.toContain("ProductRepository.purge");
    expect(repository).not.toContain("async purge(");

    const callIndex = hook.indexOf("await executePurgeProducts(");
    const clearIndex = hook.indexOf("setProducts([]);", callIndex);
    const reloadIndex = hook.indexOf(
      'await loadProducts("reset");',
      callIndex,
    );

    expect(callIndex).toBeGreaterThanOrEqual(0);
    expect(clearIndex).toBeGreaterThan(callIndex);
    expect(reloadIndex).toBeGreaterThan(clearIndex);
  });

  it("labels the destructive action as the full product purge", () => {
    const hero = fs.readFileSync(
      path.join(repoRoot, "src/app/(admin)/products/components/ProductHero.tsx"),
      "utf8",
    );

    expect(hero).toContain("<span>Purge Products</span>");
    expect(hero).toContain("disabled={!isAdmin || purging}");
    expect(hero).not.toContain("productsCount === 0");
    expect(hero).not.toContain("Purge Loaded");
  });
});
