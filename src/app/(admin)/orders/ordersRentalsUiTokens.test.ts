import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ORDERS_DIR = resolve(__dirname, "..", "orders");
const RENTALS_DIR = resolve(__dirname, "..", "rentals");

function readOrdersFile(subpath: string): string {
  return readFileSync(resolve(ORDERS_DIR, subpath), "utf-8");
}

function readRentalsFile(subpath: string): string {
  return readFileSync(resolve(RENTALS_DIR, subpath), "utf-8");
}

describe("Orders UI token regression", () => {
  it("orders page.tsx has no dynamically interpolated Tailwind variants", () => {
    const src = readOrdersFile("page.tsx");
    expect(src).not.toMatch(/hover:\$\{/);
    expect(src).not.toMatch(/focus:\$\{/);
    expect(src).not.toMatch(/group-hover:\$\{/);
  });

  it("orders page.tsx uses alerts.danger for auth gate not shadow-glow", () => {
    const src = readOrdersFile("page.tsx");
    expect(src).toContain("alerts.danger");
    expect(src).not.toMatch(/shadow-\[0_0_35px/);
  });

  it("orders authentication gate remains accessible", () => {
    const src = readOrdersFile("page.tsx");

    const authMessageIndex = src.indexOf(
      "Authentication required to access orders.",
    );

    expect(authMessageIndex).toBeGreaterThan(-1);

    const authGate = src.slice(
      Math.max(0, authMessageIndex - 200),
      authMessageIndex + 100,
    );

    expect(authGate).toContain('role="alert"');
    expect(authGate).not.toContain('aria-hidden="true"');
  });
  it("orders page.tsx uses colors.pulse not sky-cyan glow", () => {
    const src = readOrdersFile("page.tsx");
    expect(src).toContain("colors.pulse");
    expect(src).not.toMatch(/bg-sky-200/);
    expect(src).not.toMatch(/shadow-\[0_0_10px/);
  });

  it("orders page.tsx description uses typography.bodyMuted not casual tone", () => {
    const src = readOrdersFile("page.tsx");
    expect(src).toContain("typography.bodyMuted");
    expect(src).not.toMatch(/clipboard hostage/);
  });

  it("OrdersHeader uses badges.info not cyan backdrop-blur", () => {
    const src = readOrdersFile("components/OrdersHeader.tsx");
    expect(src).toContain("badges.info");
    expect(src).not.toMatch(/shadow-cyan-950/);
    expect(src).not.toContain("backdrop-blur-xl");
  });

  it("OrdersHeader uses typography.pageTitle not inline font-bold", () => {
    const src = readOrdersFile("components/OrdersHeader.tsx");
    expect(src).toContain("typography.pageTitle");
    expect(src).not.toMatch(/text-3xl font-bold/);
  });

  it("OrdersSummaryGrid uses surfaces.focus not hardcoded ring", () => {
    const src = readOrdersFile("components/OrdersSummaryGrid.tsx");
    expect(src).toContain("surfaces.focus");
    expect(src).not.toMatch(/focus-visible:ring-\[#7a9a5e\]\/40/);
  });

  it("OrdersSummaryGrid uses tiles.icon for icon container", () => {
    const src = readOrdersFile("components/OrdersSummaryGrid.tsx");
    expect(src).toContain("tiles.icon");
    expect(src).not.toMatch(/rounded-2xl.*colors\.neutral/);
  });

  it("OrdersTable TableHead uses tables.headCell token", () => {
    const src = readOrdersFile("components/OrdersTable.tsx");
    expect(src).toContain("tables.headCell");
  });

  it("OrdersTabs uses theme tokens not cyan glass", () => {
    const src = readOrdersFile("components/OrdersTabs.tsx");
    expect(src).toContain("tiles");
    expect(src).not.toMatch(/backdrop-blur-xl/);
    expect(src).not.toMatch(/shadow-inner/);
  });

  it("OrderModal has dialog semantics", () => {
    const src = readOrdersFile("components/OrderModal.tsx");
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain("aria-labelledby");
  });

  it("OrderModal overlay uses colors.overlay not backdrop-blur", () => {
    const src = readOrdersFile("components/OrderModal.tsx");
    expect(src).toContain("colors.overlay");
    expect(src).not.toContain("backdrop-blur-xl");
  });

  it("OrderModal uses colors.textDanger for required indicator", () => {
    const src = readOrdersFile("components/OrderModal.tsx");
    expect(src).toContain("colors.textDanger");
    expect(src).not.toMatch(/text-rose-300/);
  });

  it("SmartCommandStrip has no backdrop-blur", () => {
    const src = readOrdersFile("components/SmartCommandStrip.tsx");
    expect(src).not.toContain("backdrop-blur-xl");
    expect(src).not.toMatch(/shadow-inner shadow-black/);
  });
});

describe("Rentals UI token regression", () => {
  it("rentals page.tsx has no dynamically interpolated Tailwind variants", () => {
    const src = readRentalsFile("page.tsx");
    expect(src).not.toMatch(/hover:\$\{/);
    expect(src).not.toMatch(/focus:\$\{/);
    expect(src).not.toMatch(/group-hover:\$\{/);
  });

  it("rentals page.tsx description uses professional tone", () => {
    const src = readRentalsFile("page.tsx");
    expect(src).not.toMatch(/funny habit/);
    expect(src).not.toMatch(/witness protection/);
  });

  it("rentals page.tsx uses colors.textInfo not cyan for sync message", () => {
    const src = readRentalsFile("page.tsx");
    expect(src).not.toMatch(/text-cyan-100/);
  });

  it("ExchangeRentalModal has dialog semantics", () => {
    const src = readRentalsFile("page.tsx");
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain("aria-labelledby");
  });

  it("ExchangeRentalModal uses colors.overlay not backdrop-blur", () => {
    const src = readRentalsFile("page.tsx");
    expect(src).toContain("colors.overlay");
    expect(src).not.toContain("backdrop-blur-xl");
    expect(src).not.toContain("backdrop-blur-sm");
  });

  it("RentalsHeader uses colors.info not cyan shell", () => {
    const src = readRentalsFile("components/RentalsHeader.tsx");
    expect(src).toContain("colors.info");
    expect(src).not.toMatch(/bg-cyan-300\/10/);
    expect(src).not.toMatch(/border-cyan-300\/20/);
    expect(src).not.toMatch(/text-cyan-100/);
  });

  it("RentalsHeader uses typography.pageTitle not inline font-bold", () => {
    const src = readRentalsFile("components/RentalsHeader.tsx");
    expect(src).toContain("typography.pageTitle");
    expect(src).not.toMatch(/text-3xl font-bold/);
  });

  it("StatCard uses surfaces.focus not hardcoded ring", () => {
    const src = readRentalsFile("components/StatCard.tsx");
    expect(src).toContain("surfaces.focus");
    expect(src).not.toMatch(/focus-visible:ring-\[#7a9a5e\]\/40/);
  });

  it("StatCard uses tiles.icon not rounded-2xl", () => {
    const src = readRentalsFile("components/StatCard.tsx");
    expect(src).toContain("tiles.icon");
  });

  it("RentalForm uses buttons tokens not cyan", () => {
    const src = readRentalsFile("components/RentalForm.tsx");
    expect(src).not.toMatch(/bg-cyan-300/);
    expect(src).not.toMatch(/text-slate-950/);
    expect(src).not.toContain("shadow-cyan-950");
    expect(src).toContain("buttons.primary");
  });

  it("RentalForm description is professional", () => {
    const src = readRentalsFile("components/RentalForm.tsx");
    expect(src).not.toMatch(/Back in my day/);
    expect(src).not.toMatch(/slightly less cursed/);
  });

  it("RentalMobileCard uses theme tokens not hardcoded colors", () => {
    const src = readRentalsFile("components/RentalMobileCard.tsx");
    expect(src).toContain("colors.textPrimary");
    expect(src).toContain("colors.textSecondary");
    expect(src).not.toMatch(/text-white/);
    expect(src).not.toMatch(/text-cyan-100/);
  });

  it("RentalMobileCard status badge uses badges.info not cyan", () => {
    const src = readRentalsFile("components/RentalMobileCard.tsx");
    expect(src).toContain("badges.info");
    expect(src).not.toMatch(/bg-cyan-300\/10/);
  });

  it("RentalTableRow hover uses theme not bg-white/[]", () => {
    const src = readRentalsFile("components/RentalTableRow.tsx");
    expect(src).not.toMatch(/bg-white\/\[0\.035\]/);
  });

  it("RentalEquipmentTiles uses sage ring not cyan", () => {
    const src = readRentalsFile("components/RentalEquipmentTiles.tsx");
    expect(src).not.toMatch(/ring-cyan-300/);
  });

  it("RentalRecords description is professional", () => {
    const src = readRentalsFile("components/RentalRecords.tsx");
    expect(src).not.toMatch(/audit pain/);
  });

  it("EmptyState uses surfaces not backdrop-blur", () => {
    const src = readRentalsFile("components/shared/EmptyState.tsx");
    expect(src).not.toContain("backdrop-blur-xl");
    expect(src).not.toMatch(/bg-black\/20/);
    expect(src).not.toMatch(/text-cyan-200/);
  });

  it("TextInput uses forms.input not hardcoded cyan focus", () => {
    const src = readRentalsFile("components/fields/TextInput.tsx");
    expect(src).toContain("forms.input");
    expect(src).not.toMatch(/focus:border-cyan/);
    expect(src).not.toMatch(/focus:ring-cyan/);
    expect(src).not.toMatch(/text-white/);
    expect(src).not.toMatch(/bg-black\/30/);
  });

  it("SelectField uses forms.select not hardcoded cyan", () => {
    const src = readRentalsFile("components/fields/SelectField.tsx");
    expect(src).toContain("forms.select");
    expect(src).not.toMatch(/focus:border-cyan/);
    expect(src).not.toMatch(/bg-slate-950/);
    expect(src).not.toMatch(/bg-black\/30/);
    expect(src).not.toMatch(/text-white/);
  });

  it("Textarea uses forms.textarea not hardcoded cyan", () => {
    const src = readRentalsFile("components/fields/Textarea.tsx");
    expect(src).toContain("forms.textareaCompact");
    expect(src).not.toMatch(/focus:border-cyan/);
    expect(src).not.toMatch(/bg-slate-950/);
    expect(src).not.toMatch(/bg-black\/30/);
    expect(src).not.toMatch(/text-white/);
    expect(src).not.toMatch(/text-red-300/);
  });

  it("SectionHeader uses colors.textInfo not cyan eyebrow", () => {
    const src = readRentalsFile("components/shared/SectionHeader.tsx");
    expect(src).toContain("colors.textInfo");
    expect(src).not.toMatch(/text-cyan-200/);
  });

  it("ExchangeRentalModal inputs use forms tokens", () => {
    const src = readRentalsFile("page.tsx");
    expect(src).not.toMatch(/border-white\/10/);
    expect(src).not.toMatch(/bg-black\/30/);
    expect(src).not.toMatch(/text-white outline-none/);
  });

  it("Exchange action is not styled as destructive delete", () => {
    const src = readRentalsFile("page.tsx");
    const modalStart = src.indexOf("function ExchangeRentalModal(");
    const modalCode = src.slice(modalStart);
    expect(modalCode).not.toMatch(/buttons\.danger/);
    expect(modalCode).not.toMatch(/buttons\.compactDanger/);
    expect(modalCode).toContain("buttons.primary");
  });
});
