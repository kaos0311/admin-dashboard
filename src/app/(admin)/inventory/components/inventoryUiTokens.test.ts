import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const DIR = resolve(__dirname);

function readComponent(subpath: string): string {
  return readFileSync(resolve(DIR, subpath), "utf-8");
}

describe("Inventory UI token regression", () => {
  it("SearchInput uses forms.inputIconLeft token without backdrop-blur", () => {
    const src = readComponent("./fields/SearchInput.tsx");
    expect(src).toContain("forms.inputIconLeft");
    expect(src).not.toContain("backdrop-blur-xl");
    expect(src).not.toContain("bg-[#181818]/90");
  });

  it("InventoryHeader uses surfaces.toolbar not gradient headers", () => {
    const src = readComponent("./InventoryHeader.tsx");
    expect(src).toContain("surfaces.toolbar");
    expect(src).not.toMatch(/bg-gradient-to-br/);
    expect(src).not.toMatch(/backdrop-blur-2xl/);
    expect(src).not.toMatch(/shadow-2xl/);
  });

  it("InventoryHeader buttons use buttons.secondary token", () => {
    const src = readComponent("./InventoryHeader.tsx");
    expect(src).toContain("buttons.secondary");
    expect(src).not.toMatch(/shadow-lg shadow-black/);
    expect(src).not.toMatch(/backdrop-blur-xl/);
  });

  it("InventoryBatchActions uses semantic button tokens", () => {
    const src = readComponent("./InventoryBatchActions.tsx");
    expect(src).toContain("buttons.warning");
    expect(src).toContain("buttons.danger");
    expect(src).toContain("buttons.secondary");
    expect(src).not.toMatch(/backdrop-blur-xl/);
    expect(src).not.toMatch(/shadow-lg shadow-black/);
  });

  it("InventoryHero uses sage pulse dot not cyan glow", () => {
    const src = readComponent("./InventoryHero.tsx");
    expect(src).toContain("colors.pulse");
    expect(src).not.toMatch(/bg-sky-200/);
    expect(src).not.toMatch(/shadow-\[0_0_10px/);
  });

  it("InventoryHero uses panelPadded not card with gradient", () => {
    const src = readComponent("./InventoryHero.tsx");
    expect(src).toContain("glass.panelPadded");
    expect(src).not.toMatch(/rounded-\[2rem\]/);
  });

  it("InventoryEmptyState uses theme icon tokens", () => {
    const src = readComponent("./InventoryEmptyState.tsx");
    expect(src).toContain("tiles.icon");
    expect(src).toContain("colors.textMuted");
  });

  it("InventoryStats uses surfaces.focus not hardcoded ring", () => {
    const src = readComponent("./InventoryStats.tsx");
    expect(src).toContain("surfaces.focus");
    expect(src).not.toMatch(/focus-visible:ring-\[#7a9a5e\]\/40/);
  });

  it("InventoryStatsStatCard uses tiles.icon not inline classes", () => {
    const src = readComponent("./InventoryStats.tsx");
    expect(src).toContain("tiles.icon");
  });

  it("InventoryPills have no backdrop-blur", () => {
    const src = readComponent("./InventoryPills.tsx");
    expect(src).not.toContain("backdrop-blur");
  });

  it("InventoryAssetTiles uses colors.textInfo not cyan", () => {
    const src = readComponent("./InventoryAssetTiles.tsx");
    expect(src).not.toMatch(/text-cyan-200/);
  });

  it("InventoryFacilityRentalTiles uses sage tokens not cyan", () => {
    const src = readComponent("./InventoryFacilityRentalTiles.tsx");
    expect(src).not.toMatch(/cyan-300/);
    expect(src).not.toMatch(/cyan-200/);
  });

  it("InventoryTableRow uses theme border tokens not border-white/10", () => {
    const src = readComponent("./InventoryTableRow.tsx");
    expect(src).toContain("colors.borderMuted");
    expect(src).not.toMatch(/border-white\/10/);
    expect(src).not.toMatch(/hover:bg-white\/\[0\.04\]/);
  });

  it("InventoryTable nested tables use theme tokens", () => {
    const src = readComponent("./InventoryTable.tsx");
    expect(src).not.toMatch(/border-white\/10/);
    expect(src).not.toMatch(/hover:bg-white\/\[0\.04\]/);
  });

  it("ScanAssignmentModal uses colors.overlay not slate backdrop", () => {
    const src = readComponent("./ScanAssignmentModal.tsx");
    expect(src).toContain("colors.overlay");
    expect(src).not.toMatch(/bg-slate-950/);
    expect(src).not.toMatch(/backdrop-blur-xl/);
  });

  it("JarvisNoticeModal uses colors.overlay not slate backdrop", () => {
    const src = readComponent("./JarvisNoticeModal.tsx");
    expect(src).toContain("colors.overlay");
    expect(src).not.toMatch(/bg-slate-950/);
    expect(src).not.toMatch(/backdrop-blur-xl/);
  });

  it("ScanSuccessModal uses colors.overlay not slate backdrop", () => {
    const src = readComponent("./ScanSuccessModal.tsx");
    expect(src).toContain("colors.overlay");
    expect(src).not.toMatch(/bg-slate-950/);
    expect(src).not.toMatch(/backdrop-blur-xl/);
  });

  it("Scanner page has no cyan/sky accent colors", () => {
    const src = readComponent("../scanner/page.tsx");
    expect(src).not.toMatch(/text-sky-200/);
    expect(src).not.toMatch(/bg-sky-200/);
    expect(src).not.toMatch(/bg-cyan/);
    expect(src).not.toMatch(/text-cyan/);
  });

  it("Asset detail page uses panelPadded not gradient", () => {
    const src = readComponent("../[assetId]/page.tsx");
    expect(src).not.toMatch(/bg-gradient-to-br/);
    expect(src).not.toMatch(/backdrop-blur-2xl/);
    expect(src).toContain("glass.panelPadded");
  });

  it("Subroute pages use typography.pageTitle not inline font classes", () => {
    const assetRecords = readComponent("../asset-records/page.tsx");
    const rentalProp = readComponent("../rental-property/page.tsx");
    expect(assetRecords).toContain("typography.pageTitle");
    expect(rentalProp).toContain("typography.pageTitle");
    expect(assetRecords).not.toMatch(/text-3xl font-bold/);
    expect(rentalProp).not.toMatch(/text-3xl font-bold/);
  });

  it("InventoryDataQualityPanel uses forms.select for selects", () => {
    const src = readComponent("./InventoryDataQualityPanel.tsx");
    expect(src).toContain("forms.select");
    expect(src).toContain("forms.input");
    expect(src).not.toMatch(/bg-black\/30/);
  });

  it("InventoryDataQualityPanel severity badges use theme colors", () => {
    const src = readComponent("./InventoryDataQualityPanel.tsx");
    expect(src).toContain("colors.dangerBadge");
    expect(src).toContain("colors.warningBadge");
    expect(src).toContain("colors.neutralBadge");
    expect(src).not.toMatch(/border-red-400\/30/);
    expect(src).not.toMatch(/border-orange-400\/30/);
    expect(src).not.toMatch(/border-yellow-400\/30/);
  });
});
