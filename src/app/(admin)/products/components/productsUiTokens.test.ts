import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const DIR = resolve(__dirname);

function readComponent(subpath: string): string {
  return readFileSync(resolve(DIR, subpath), "utf-8");
}

describe("Products UI token regression", () => {
  it("page.tsx has no dynamically interpolated Tailwind variants", () => {
    const src = readComponent("../page.tsx");
    expect(src).not.toMatch(/hover:\$\{/);
    expect(src).not.toMatch(/focus:\$\{/);
    expect(src).not.toMatch(/group-hover:\$\{/);
  });

  it("page.tsx does not use inline ProductHero duplication", () => {
    const src = readComponent("../page.tsx");
    expect(src).not.toContain("<ProductHero");
  });

  it("ProductStatsGrid uses surfaces.focus not hardcoded ring", () => {
    const src = readComponent("./ProductStatsGrid.tsx");
    expect(src).toContain("surfaces.focus");
    expect(src).not.toMatch(/focus-visible:ring-\[#7a9a5e\]/);
  });

  it("ProductStatsGrid uses tiles.icon not inline shadow classes", () => {
    const src = readComponent("./ProductStatsGrid.tsx");
    expect(src).toContain("tiles.icon");
    expect(src).not.toMatch(/shadow-inner shadow-black\/30/);
  });

  it("ProductStatsGrid uses tiles.token classes", () => {
    const src = readComponent("./ProductStatsGrid.tsx");
    expect(src).toContain("tiles.value");
    expect(src).toContain("tiles.metricLabel");
  });

  it("ProductCatalog uses colors.borderMuted not border-white/10", () => {
    const src = readComponent("./ProductCatalog.tsx");
    expect(src).toContain("colors.borderMuted");
    expect(src).not.toMatch(/border-white\/10/);
    expect(src).not.toMatch(/divide-white\/10/);
    expect(src).not.toMatch(/bg-slate-950/);
    expect(src).not.toMatch(/shadow-\[-14px/);
  });

  it("ProductMobileCard uses glass.cardPadded not backdrop-blur", () => {
    const src = readComponent("./ProductMobileCard.tsx");
    expect(src).toContain("glass.cardPadded");
    expect(src).not.toContain("backdrop-blur-2xl");
    expect(src).not.toMatch(/bg-white\/\[0\.06\]/);
    expect(src).not.toMatch(/text-slate-100/);
    expect(src).not.toMatch(/text-slate-300/);
  });

  it("ProductMobileCard uses colors.textSecondary for meta info", () => {
    const src = readComponent("./ProductMobileCard.tsx");
    expect(src).toContain("colors.textSecondary");
  });

  it("ProductTableRow uses buttons tokens not hardcoded accent", () => {
    const src = readComponent("./ProductTableRow.tsx");
    expect(src).toContain("buttons.icon");
    expect(src).toContain("buttons.iconDanger");
    expect(src).not.toMatch(/accent-sky-400/);
  });

  it("ProductTableRow uses glass.toolbar for sticky actions", () => {
    const src = readComponent("./ProductTableRow.tsx");
    expect(src).toContain("glass.toolbar");
  });

  it("ProductFilters uses buttons.danger for archive action", () => {
    const src = readComponent("./ProductFilters.tsx");
    expect(src).toContain("colors.danger");
    expect(src).not.toMatch(/bg-red-400\/10/);
    expect(src).not.toMatch(/border-red-400\/20/);
  });

  it("ProductInputs uses theme tokens not accent-sky", () => {
    const src = readComponent("./ProductInputs.tsx");
    expect(src).not.toMatch(/accent-sky-400/);
  });

  it("ProductThumb uses surfaces.iconBoxSm not glass shells", () => {
    const src = readComponent("./ProductThumb.tsx");
    expect(src).toContain("surfaces.iconBoxSm");
    expect(src).not.toMatch(/bg-white\/\[0\.06\]/);
    expect(src).not.toMatch(/border-white\/10/);
  });

  it("ProductRecallWatch uses badges.warning not amber classes", () => {
    const src = readComponent("./ProductRecallWatch.tsx");
    expect(src).toContain("badges.warning");
    expect(src).not.toMatch(/text-amber-200/);
    expect(src).not.toMatch(/bg-amber-300\/10/);
    expect(src).not.toMatch(/border-amber-300\/30/);
  });

  it("ProductRecallWatch uses colors.textWarning not amber", () => {
    const src = readComponent("./ProductRecallWatch.tsx");
    expect(src).toContain("colors.textWarning");
  });

  it("ProductRecallWatch uses colors.textInfo not cyan", () => {
    const src = readComponent("./ProductRecallWatch.tsx");
    expect(src).toContain("colors.textInfo");
    expect(src).not.toMatch(/text-cyan-100/);
  });

  it("ProductRecallWatch toggle uses sage not cyan", () => {
    const src = readComponent("./ProductRecallWatch.tsx");
    expect(src).not.toMatch(/bg-cyan-300/);
    expect(src).not.toMatch(/border-cyan-300/);
  });

  it("ProductRecallWatch RecallSwitch uses surfaces.insetPadded", () => {
    const src = readComponent("./ProductRecallWatch.tsx");
    expect(src).toContain("surfaces.insetPadded");
    expect(src).not.toMatch(/border-white\/10/);
    expect(src).not.toMatch(/bg-black\/20/);
  });

  it("ProductRecallWatch uses colors.textPrimary not text-white", () => {
    const src = readComponent("./ProductRecallWatch.tsx");
    expect(src).toContain("colors.textPrimary");
    expect(src).not.toMatch(/text-white/);
  });
});
