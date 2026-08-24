/// <reference types="vitest/globals" />
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { badges } from "./badges";
import { buttons } from "./buttons";
import { colors } from "./colors";
import { forms } from "./forms";
import { navigation } from "./navigation";
import { spacing } from "./spacing";
import { surfaces } from "./surfaces";
import { tables } from "./tables";
import { tiles } from "./tileSystem";
import { typography } from "./typography";

describe("theme foundation compatibility", () => {
  describe("colors", () => {
    const requiredKeys = [
      "app", "adminShell",
      "textPrimary", "textSecondary", "textMuted", "textFaint",
      "textInverse", "textDisabled",
      "textInfo", "textSuccess", "textWarning", "textDanger",
      "border", "borderStrong", "borderMuted",
      "surface", "surfaceHover", "surfaceStrong", "surfaceInset",
      "surfaceInput", "surfaceInputFocus",
      "overlay", "grid", "vignette",
      "shadow", "shadowStrong",
      "success", "warning", "warningBanner", "danger", "info", "neutral",
      "successBadge", "warningBadge", "dangerBadge", "infoBadge",
      "neutralBadge", "activeBadge",
      "pulse", "dangerPulse", "successPulse",
    ];

    it.each(requiredKeys)("exports colors.%s", (key: string) => {
      expect(colors).toHaveProperty(key);
      expect(typeof colors[key as keyof typeof colors]).toBe("string");
      expect((colors[key as keyof typeof colors] as string).length).toBeGreaterThan(0);
    });

    it("preserves olive/sage accent around #7a9a5e", () => {
      expect(colors.textInfo).toMatch(/7a9a5e/);
      expect(colors.infoBadge).toMatch(/7a9a5e/);
      expect(colors.info).toMatch(/7a9a5e/);
    });

    it("does not use cyan/blue as global app accent", () => {
      expect(colors.app).not.toMatch(/#06b6d4|#2563eb|#0ea5e9|#0284c7/);
      expect(colors.info).not.toMatch(/#06b6d4|#2563eb|#0ea5e9|#0284c7/);
    });
  });

  describe("surfaces", () => {
    const requiredKeys = [
      "panelBefore", "page", "shell", "shellTight", "shellFull",
      "panel", "panelPadded", "card", "cardPadded", "cardHover",
      "statCard", "listItem", "menuItem", "selectedListItem",
      "inset", "insetPadded", "toolbar", "toolbarPadded",
      "input", "inputPadded", "textarea", "select",
      "chip", "iconBox", "iconBoxSm", "emptyState",
      "alertInfo", "alertSuccess", "alertWarning", "alertDanger",
      "table", "tableHeader", "tableRow", "tableCell",
      "divider", "progressTrack", "progressFill",
      "riskHigh", "riskMedium", "riskLow", "riskMinimal",
      "focus", "pageCenter", "loadingCard", "authCard",
      "dangerPanel", "inputIcon",
    ];

    it.each(requiredKeys)("exports surfaces.%s", (key: string) => {
      expect(surfaces).toHaveProperty(key);
      expect(typeof surfaces[key as keyof typeof surfaces]).toBe("string");
    });

    it("does not contain backdrop-blur in surface tokens", () => {
      for (const key of Object.keys(surfaces)) {
        const value = surfaces[key as keyof typeof surfaces];
        if (typeof value === "string") {
          expect(value).not.toMatch(/backdrop-blur/);
        }
      }
    });

    it("shadows are at most xl strength, not 3xl", () => {
      for (const key of ["panel", "card", "statCard", "loadingCard", "table", "toolbar"]) {
        const value = surfaces[key as keyof typeof surfaces] as string;
        expect(value).not.toMatch(/shadow-3xl/);
      }
    });
  });

  describe("buttons", () => {
    const requiredKeys = [
      "base", "primary", "secondary", "upload", "danger", "warning",
      "success", "info", "ghost", "subtle",
      "compact", "compactPrimary", "compactSecondary", "compactDanger",
      "compactWarning", "compactSuccess",
      "icon", "iconDanger", "iconSuccess", "iconWarning",
      "iconArchive", "iconDelete", "iconInline", "fullPrimary",
    ];

    it.each(requiredKeys)("exports buttons.%s", (key: string) => {
      expect(buttons).toHaveProperty(key);
      expect(typeof buttons[key as keyof typeof buttons]).toBe("string");
      expect((buttons[key as keyof typeof buttons] as string).length).toBeGreaterThan(0);
    });

    it("all button variants have a focus ring", () => {
      for (const key of ["primary", "secondary", "ghost", "danger", "icon"]) {
        const value = buttons[key as keyof typeof buttons] as string;
        expect(value).toMatch(/focus:ring/);
      }
    });

    it("all button variants have disabled state", () => {
      for (const key of ["primary", "secondary", "ghost", "danger", "icon"]) {
        const value = buttons[key as keyof typeof buttons] as string;
        expect(value).toMatch(/disabled:/);
      }
    });
  });

  describe("forms", () => {
    const requiredKeys = [
      "input", "textarea", "textareaCompact", "select",
      "label", "helper", "error", "field",
      "inputIconLeft", "inputIconBoth", "fileInput",
    ];

    it.each(requiredKeys)("exports forms.%s", (key: string) => {
      expect(forms).toHaveProperty(key);
      expect(typeof forms[key as keyof typeof forms]).toBe("string");
    });
  });

  describe("tables", () => {
    const requiredKeys = [
      "wrapper", "shell", "toolbar", "toolbarActions", "filterGrid",
      "field", "label", "select",
      "searchWrap", "searchIcon", "searchInput",
      "scroll", "table", "caption",
      "head", "headRow", "headCell", "headCellRight",
      "headerCell", "headerCellRight",
      "body", "row", "selectedRow",
      "cell", "cellStrong", "cellMuted", "cellRight",
      "empty", "loadingState", "emptyInline",
      "badge", "actionIcon", "actionIconDanger",
      "checkboxButton", "checkboxBox",
    ];

    it.each(requiredKeys)("exports tables.%s", (key: string) => {
      expect(tables).toHaveProperty(key);
      expect(typeof tables[key as keyof typeof tables]).toBe("string");
    });

    it("has selected row styling", () => {
      expect(tables.selectedRow).toBeTruthy();
      expect(tables.selectedRow).toMatch(/bg-\[#7a9a5e\]/);
    });
  });

  describe("typography", () => {
    const requiredKeys = [
      "eyebrow", "pageTitle", "sectionTitle", "cardTitle", "hero",
      "subTitle", "body", "bodyStrong", "bodyMuted", "bodyFaint",
      "small", "smallMuted", "caption", "label", "formLabel", "helper",
      "warningStrong", "warningText", "dangerText",
      "metric", "metricCompact", "metricSmall",
      "mono", "monoMuted", "code",
    ];

    it.each(requiredKeys)("exports typography.%s", (key: string) => {
      expect(typography).toHaveProperty(key);
      expect(typeof typography[key as keyof typeof typography]).toBe("string");
    });
  });

  describe("spacing", () => {
    const requiredKeys = [
      "page", "pageTight", "section", "sectionTight",
      "card", "cardLg", "stack", "stackTight", "stackLoose",
      "inline", "inlineMd", "inlineLg", "actions",
      "gridCards", "gridCardsThree", "gridCardsTwo",
      "gridResponsive", "gridTwo", "gridThree", "gridFour",
      "split", "content", "contentTight",
    ];

    it.each(requiredKeys)("exports spacing.%s", (key: string) => {
      expect(spacing).toHaveProperty(key);
      expect(typeof spacing[key as keyof typeof spacing]).toBe("string");
    });
  });

  describe("tiles", () => {
    const requiredKeys = [
      "base", "hover", "metric", "action", "operational", "compact",
      "alert", "system", "header", "icon",
      "label", "metricLabel", "title", "value", "helper", "description",
      "badge", "tag", "tagMuted",
      "gridMetrics", "gridSections", "gridTwo",
    ];

    it.each(requiredKeys)("exports tiles.%s", (key: string) => {
      expect(tiles).toHaveProperty(key);
      expect(typeof tiles[key as keyof typeof tiles]).toBe("string");
    });
  });

  describe("badges", () => {
    const requiredKeys = [
      "success", "warning", "danger", "info", "neutral", "active",
      "kpiCard", "kpiIcon", "pulseDot",
    ];

    it.each(requiredKeys)("exports badges.%s", (key: string) => {
      expect(badges).toHaveProperty(key);
      const value = badges[key as keyof typeof badges];
      expect(value).toBeTruthy();
    });
  });

  describe("navigation", () => {
    const requiredKeys = [
      "sidebarShell", "mobileOverlay", "mobileBackdrop", "mobileShell",
      "mobileHeader", "brandCard", "inner", "scrollArea", "section",
      "sectionLabel", "sectionStack", "itemBase", "itemActive",
      "itemInactive", "iconBase", "iconActive", "iconInactive",
      "closeButton", "activeDot", "inactiveDot", "badge", "health",
    ];

    it.each(requiredKeys)("exports navigation.%s", (key: string) => {
      expect(navigation).toHaveProperty(key);
      expect(typeof navigation[key as keyof typeof navigation]).toBe("string");
    });

    it("active navigation does not use glowing shadows", () => {
      expect(navigation.itemActive).not.toMatch(/shadow-\[0_0_\d+px/);
      expect(navigation.iconActive).not.toMatch(/shadow-\[0_0_\d+px/);
    });
  });
});

describe("admin layout integrity", () => {
  const layoutPath = join(process.cwd(), "src", "app", "(admin)", "layout.tsx");

  it("layout file exists", () => {
    expect(existsSync(layoutPath)).toBe(true);
  });

  it("does not contain malformed skip-link class focus:px-4focus:py-2", () => {
    const content = readFileSync(layoutPath, "utf-8");
    expect(content).not.toMatch(/focus:px-4focus:py-2/);
    expect(content).toMatch(/focus:px-4 focus:py-2/);
  });

  it("preserves sr-only skip-link with focus-visible transition", () => {
    const content = readFileSync(layoutPath, "utf-8");
    expect(content).toMatch(/sr-only focus:not-sr-only/);
    expect(content).toMatch(/#admin-main-content/);
  });

  it("maintains sticky toolbar and lg:ml-64 content relationship", () => {
    const content = readFileSync(layoutPath, "utf-8");
    expect(content).toMatch(/sticky top-0/);
    expect(content).toMatch(/lg:ml-64/);
  });
});
