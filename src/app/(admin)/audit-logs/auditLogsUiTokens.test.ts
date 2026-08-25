import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const AUDIT_DIR = resolve(__dirname);

function readAuditFile(subpath: string): string {
  return readFileSync(resolve(AUDIT_DIR, subpath), "utf-8");
}

describe("Audit Logs UI token regression", () => {
  it("AuditFilters uses foundation panel and form tokens", () => {
    const src = readAuditFile("components/AuditFilters.tsx");
    expect(src).toContain("glass.panel");
    expect(src).toContain("forms.input");
    expect(src).toContain("buttons.secondary");
  });

  it("AuditFilters contains no heavy backdrop blur", () => {
    const src = readAuditFile("components/AuditFilters.tsx");
    expect(src).not.toMatch(/backdrop-blur-(xl|2xl|3xl)/);
  });

  it("AuditFilters contains no hardcoded white or black form surfaces", () => {
    const src = readAuditFile("components/AuditFilters.tsx");
    expect(src).not.toMatch(/border-white\/50/);
    expect(src).not.toMatch(/bg-white\/70/);
    expect(src).not.toMatch(/dark:bg-black\/20/);
  });

  it("SelectField uses forms.select", () => {
    const src = readAuditFile("components/SelectField.tsx");
    expect(src).toContain("forms.select");
    expect(src).not.toMatch(/backdrop-blur-xl/);
    expect(src).not.toMatch(/focus:border-blue/);
  });

  it("SelectField does not hardcode native option colors", () => {
    const src = readAuditFile("components/SelectField.tsx");
    expect(src).not.toMatch(/bg-white text-slate-950/);
    expect(src).not.toMatch(/dark:bg-slate-950/);
  });

  it("AuditWatchList uses foundation panels", () => {
    const src = readAuditFile("components/AuditWatchList.tsx");
    expect(src).toContain("glass.panel");
    expect(src).toContain("glass.inset");
    expect(src).toContain("alerts.danger");
  });

  it("AuditWatchList contains no heavy backdrop blur", () => {
    const src = readAuditFile("components/AuditWatchList.tsx");
    expect(src).not.toMatch(/backdrop-blur-(xl|2xl|3xl)/);
  });

  it("AuditWatchList uses danger color token rather than red text utilities", () => {
    const src = readAuditFile("components/AuditWatchList.tsx");
    expect(src).toContain("colors.textDanger");
    expect(src).not.toMatch(/text-red-700/);
    expect(src).not.toMatch(/text-red-200/);
  });

  it("AuditList uses glass inset for inactive rows", () => {
    const src = readAuditFile("components/AuditList.tsx");
    expect(src).toContain("glass.inset");
    expect(src).not.toMatch(/bg-white\/\[0\.045\]/);
  });

  it("SummaryCard uses the shared focus token", () => {
    const src = readAuditFile("components/SummaryCard.tsx");
    expect(src).toContain("surfaces.focus");
    expect(src).not.toMatch(/focus-visible:ring-\[#7a9a5e\]/);
  });

  it("Audit Logs page uses the shared danger alert", () => {
    const src = readAuditFile("page.tsx");
    expect(src).toContain("alerts.danger");
    expect(src).not.toMatch(/shadow-\[0_0_35px/);
    expect(src).not.toMatch(/text-red-300/);
  });

  it("Audit Logs page error remains accessible", () => {
    const src = readAuditFile("page.tsx");
    expect(src).toContain('role="alert"');
  });

  it("Audit Logs page loading indicator uses theme color", () => {
    const src = readAuditFile("page.tsx");
    expect(src).toContain("colors.textInfo");
    expect(src).not.toMatch(/text-sky-200/);
  });
});