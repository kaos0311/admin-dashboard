# Theme Consistency Audit

**Generated:** 2026-06-29  
**Scope:** 80+ component files, 15+ theme definition files, globals.css, Tailwind v4

---

## Executive Summary

The codebase contains **two parallel, competing theme systems** ("Glass" and "Legacy"), each with distinct color palettes, naming conventions, and architectural philosophies. No single file consistently uses tokens from one system. 80+ component files contain hardcoded hex colors or raw Tailwind utility classes instead of referencing theme tokens. Six different accent color families and seven different gray scales are in active use.

**Severity:** Critical — every new component or change widens the inconsistency unless the team resolves to a single system.

---

## 1. The Two Theme Systems

### System A — "Glass" Theme (`src/theme/`)

| File | Approach | Accent Color |
|------|----------|-------------|
| `colors.ts` | Tailwind utility strings (e.g. `text-white`, `bg-white/10`) | **Cyan** (`cyan-300/400`, `#22d3ee`) |
| `glass.ts` | Tailwind utility strings | Cyan (hover: `border-cyan-300/35`) |
| `buttons.ts` | Tailwind utility strings | **Cyan** (`bg-cyan-400/15`, `text-cyan-50`) |
| `typography.ts` | Tailwind utility strings (e.g. `text-white`, `text-slate-300`) | Cyan (`text-cyan-200` for code) |
| `tileSystem.ts` | Tailwind + dark: variant | Cyan hover, sage green for badge |
| `badges.ts` | **Hardcoded hex** (`#6a9a6a`, `#c49a4a`, `#b84a4a`) | Sage green accent |
| `tables.ts` | **Hardcoded hex** (`#3a3a3a`, `#1c1c1c`, `#ececec`) | Sage green (`#7a9a5e`) |
| `navigation.ts` | **Hardcoded hex** | Sage green (`#7a9a5e`, `#9aba7e`) |
| `orderStatus.ts` | **Hardcoded hex** | Blue/cyan/emerald/rose/zinc |
| `forms.ts` | Hardcoded hex (re-uses surfaces.ts) | Sage green |
| `surfaces.ts` | **Hardcoded hex** (`#3a3a3a`, `#1c1c1c`, `#ececec`) | Sage green accent (`#7a9a5e`) |
| `upload.ts` | Re-exports from multiple systems | Mixed |

### System B — "Legacy" CSS Variable System (`globals.css`)

| Artifact | Approach | Accent Color |
|----------|----------|-------------|
| CSS custom properties | `--admin-bg: #141414` style variables | **Sage green** (`#7a9a5e` — the `--admin-accent` variable) |
| `.admin-card`, `.admin-panel` | CSS classes referencing custom properties | Sage green |
| `.btn-dark`, `.btn-primary` | CSS classes overriding all buttons | Sage green (`rgb(90 122 62)`) |
| `.input-dark`, `.select-dark`, `.textarea-dark` | CSS classes | Sage green focus ring |
| `.admin-table` | CSS classes | Sage green mixed |
| Toast `.custom-toast-*` | CSS classes | Emerald/red/cyan |

**Summary of the clash:**

```
┌────────────────────────────────────────────────────────┐
│                    THEME ARCHITECTURE                   │
├──────────────────────┬─────────────────────────────────┤
│   Glass (src/theme/) │  Legacy (globals.css)           │
├──────────────────────┼─────────────────────────────────┤
│ Accent: cyan (#22d3ee)│ Accent: sage green (#7a9a5e)   │
│ Unit: Tailwind class  │ Unit: CSS custom property       │
│ Border: border-white/10│ Border: --admin-border: #3a3a3a│
│ Panel: bg-slate-950/48│ Panel: --admin-panel: #1c1c1c   │
│ Radius: rounded-2xl   │ Radius: 1rem (rounded-xl/2xl)  │
│ Shadow: shadow-xl     │ Shadow: shadow-lg               │
│ Input: bg-black/45    │ Input: rgb(24 24 24)            │
│ Light mode: dark:only │ Light mode: dark:only           │
│ Typography: text-white│ Typography: --foreground: #ececec│
└──────────────────────┴─────────────────────────────────┘
```

---

## 2. Color Palette Fragmentation

### Gray Scale — 7 Distinct Systems in Use

| Palette | Example Classes | Prevalence |
|---------|----------------|------------|
| **Tailwind Slate** | `text-slate-300`, `text-slate-400`, `text-slate-500`, `bg-slate-950` | **Primary** — ~250 uses |
| **Tailwind Zinc** | `text-zinc-300`, `text-zinc-400`, `text-zinc-500`, `bg-zinc-200` | **Secondary** — ~60 uses |
| **Tailwind Neutral** | `text-neutral-300`, `text-neutral-400`, `bg-neutral-950` | Common — ~40 uses |
| **Tailwind Gray** | `text-gray-500` | Rare — ~5 uses |
| **Hardcoded Light** | `text-[#ececec]` | surfaces.ts, tables.ts, navigation.ts |
| **Hardcoded Muted** | `text-[#888888]` | tables.ts, navigation.ts |
| **Hardcoded Faint** | `text-[#606060]` | tables.ts, surfaces.ts |

**Impact:** A developer cannot know which gray to use. Components next to each other use different grays (e.g., one uses `text-slate-400`, another uses `text-zinc-400`), creating visual dissonance.

### Accent Color — 6 Families in Active Use

| Family | Hex | Where Used |
|--------|-----|------------|
| **Cyan** | `#06b6d4`, `#22d3ee`, `#0891b2` | Glass panel hover, buttons, heroes, AI page, inventory, rentals, orders, analytics |
| **Sage Green** | `#7a9a5e`, `#9aba7e`, `#6a9a6a` | surfaces, navigation, tables, badges, order status, focus rings |
| **Sky Blue** | `#7dd3fc`, `#38bdf8`, `#0ea5e9` | Patient detail, WIP status badges, barcode scanner, reports |
| **Blue** | `#60a5fa`, `#3b82f6` | Order processing status, upload queue |
| **Emerald** | `#34d399`, `#10b981` | Success badges, delivery, CPAP, tenants |
| **Rose/Red** | `#fb7185`, `#f43f5e` | Danger badges, danger buttons, alerts |

**The fundamental conflict:** The **Glass theme system** (buttons, colors, glass, typography) uses **cyan** as its accent. The **Legacy system** (surfaces, tables, navigation, globals.css, badges) uses **sage green**. Components are split roughly 50/50.

---

## 3. Hardcoded Classes vs Theme Token Usage

### Files using theme tokens consistently (good examples)
- `components/ui/Tile.tsx` — imports from `@/theme/tileSystem` (Tile component)
- `theme/alerts.ts` — re-exports from surfaces

### Files heavily using hardcoded raw classes (top offenders)
| File | Hardcoded Classes Found | Missed Token |
|------|------------------------|-------------|
| `audit-logs/components/AuditDetails.tsx` | `border-white/50`, `bg-white/60`, `text-slate-800`, `bg-white/50` | Should use `colors.border`, `surfaces.card` |
| `audit-logs/components/AuditFilters.tsx` | `border-white/50`, `bg-white/70`, `focus:border-blue-400` | Blue focus ring ≠ any theme accent |
| `inventory/components/InventoryHeader.tsx` | `bg-white/[0.07]`, `bg-white/10` | Should use `glass.panel`, `surfaces.panel` |
| `inventory/components/InventoryBatchActions.tsx` | `border-yellow-500/20`, `bg-yellow-500/10` | Should use `colors.warningBadge` |
| `products/components/ProductHero.tsx` | `bg-white/[0.07]`, `shadow-[0_20px_80px_rgba(0,0,0,0.45)]` | Should use `glass.panel` |
| `rentals/components/RentalMobileCard.tsx` | `bg-black/25`, `border-white/10` | Should use `glass.card` |
| `settings/components/TabBar.tsx` | `bg-cyan-300` for active tab | Different accent than sage green system |
| `command-center/components/DatabaseHealthPanel.tsx` | `bg-emerald-300`, `bg-cyan-300`, `bg-amber-300` | Should use `surfaces.progressFill` |
| `reports/hospice/components/HospiceStatsGrid.tsx` | `border-red-500`, `bg-red-500`, `text-red-300` | Should use `colors.dangerBadge` |

### Pattern of the problem — Example from `AuditDetails.tsx`:
```tsx
// What's written:
<section className="rounded-3xl border border-white/50 bg-white/60 p-6
  shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">

// What should use (if following Glass system):
<section className={glass.panel}>
```

And then inside the same component:
```tsx
// Hardcoded pre colors:
<pre className="mt-3 max-h-[500px] ... text-slate-800 dark:text-slate-200">

// Token exists:
<pre className={typography.code}>
```

---

## 4. Badge/Semantic Color Inconsistency

The project has **four separate locations** defining badge/semantic status colors, all slightly different:

| Location | Success | Warning | Danger | Info |
|----------|---------|---------|--------|------|
| `colors.ts` | `emerald-400/25 bg-emerald-400/10 text-emerald-100` | `amber-400/25 bg-amber-400/10 text-amber-100` | `rose-400/25 bg-rose-400/10 text-rose-100` | `cyan-400/25 bg-cyan-400/10 text-cyan-100` |
| `badges.ts` | `#6a9a6a/30 bg-#6a9a6a/10 text-#8aba8a` | `#c49a4a/30 bg-#c49a4a/10 text-#d4b86a` | `#b84a4a/30 bg-#b84a4a/10 text-#d47a7a` | `#7a9a5e/30 bg-#7a9a5e/10 text-#9aba7e` |
| `surfaces.ts` | `#6a9a6a/25 bg-#6a9a6a/8 text-#8aba8a` | `#c49a4a/25 bg-#c49a4a/8 text-#d4b86a` | `#b84a4a/25 bg-#b84a4a/8 text-#d47a7a` | `#7a9a5e/25 bg-#7a9a5e/8 text-#9aba7e` |
| `glass.ts` | `emerald-400/25 bg-emerald-500/15 text-emerald-100` | `amber-400/25 bg-amber-500/15 text-amber-100` | `rose-400/25 bg-rose-500/15 text-rose-100` | `cyan-400/25 bg-cyan-500/15 text-cyan-100` |

And dozens of components define their own inlined version, e.g.:
```tsx
// Inline in components:
className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
className="border-amber-400/25 bg-amber-400/10 text-amber-100"
className="border-red-400/20 bg-red-400/10 text-red-200"
className="border-sky-300/20 bg-sky-400/10 text-sky-100"
```

---

## 5. Shadows Are Not Standardized

| Source | Shadow Pattern | Opacity |
|--------|---------------|---------|
| `glass.panel` | `shadow-xl shadow-black/30` | 0.30 |
| `glass.card` | `shadow-xl shadow-black/25` | 0.25 |
| `surfaces.panel` | `shadow-lg shadow-black/25` | 0.25 |
| `surfaces.input` | `shadow-inner shadow-black/40` | 0.40 |
| Many components | `shadow-2xl shadow-black/30` | 0.30 |
| Many components | `shadow-2xl shadow-black/40` | 0.40 |
| Many components | `shadow-lg shadow-black/20` | 0.20 |
| Product Hero | `shadow-[0_20px_80px_rgba(0,0,0,0.45)]` | 0.45 (custom!) |

---

## 6. Globals.css Issues

### 6.1 Overlapping Concerns with Theme Modules
- `.btn-dark`, `.btn-primary`, `.btn-danger`, `.btn-success`, `.btn-muted` duplicate what `theme/buttons.ts` provides
- `.input-dark`, `.select-dark`, `.textarea-dark` duplicate what `theme/surfaces.ts` / `theme/forms.ts` provide
- `.admin-table`, `.admin-status-*` duplicate what `theme/tables.ts`, `theme/colors.ts` provide

### 6.2 Destructive Overrides
```css
/* These force every line-clamp and truncate to be visible with overflow */
#admin-main-content .truncate,
.admin-page .truncate {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}
```
This breaks `truncate` and all `line-clamp-*` utilities globally within the admin layout. Those utilities exist for a reason.

### 6.3 Universal Button Styles
```css
button {
  cursor: pointer;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.45);
  transition: ...;
}
button:active {
  translate: 0 1px;
  box-shadow: inset 0 3px 6px rgba(0,0,0,0.6);
}
```
This adds unwanted inset box-shadows and active-state translation to **every** `<button>` element, including icon buttons, tab buttons, and filter buttons where it may look wrong.

### 6.4 No Light Mode Support
All global styles target dark mode exclusively. The `globals.css` does not use `@media (prefers-color-scheme: light)` or `:root.light` overrides, despite the `ThemeProvider` supporting a light theme toggle.

---

## 7. Recommendations

### Short-term (highly actionable)

1. **Choose one accent color — and make it a CSS variable.** Currently cyan and sage green are in conflict. The dominant Sage Green (`#7a9a5e`) is already in `--admin-accent` and used by surfaces, navigation, tables — the structural layer. Cyan is used for glitz (heroes, buttons). **Decision:** Let the actual usage decide — → **Pick Sage Green as the canonical accent** (because it's in the foundational modules). Migrate cyan usage to sage green in the glass system.

2. **Fix the `truncate` and `line-clamp` override in `globals.css`.** Remove lines 68-82, or at minimum scope them only to known-breaking elements.

3. **Remove the `button:active` global translate** (`translate: 0 1px` and the `box-shadow` changes). It adds unwanted visual noise to every button in the app.

### Medium-term

4. **Standardize one gray scale.** Pick between `slate`, `zinc`, or `neutral` tailwind family. Slate is the most used (~250 references). Migrate zinc and neutral to slate equivalents:
   - `zinc-300` → `slate-300`
   - `zinc-400` → `slate-400`
   - `neutral-300` → `slate-300`
   - `neutral-950` → `slate-950`
   - `neutral-400` → `slate-400`

5. **Standardize the semantic status tokens.** There are currently 4+ definitions of success/warning/danger/info badge styles. Pick ONE source of truth (e.g., `colors.ts` in the theme module) and re-export from there. Remove badge definitions from `surfaces.ts`, `badges.ts`, and `glass.ts`, or make them re-exports.

6. **Purge one theme system.** Either:
   - **Option A:** Keep Glass (Tailwind-based, `@/theme`) and gradually migrate all usage of globals.css classes to theme tokens. Remove globals.css classes that duplicate theme tokens.
   - **Option B:** Keep CSS Variables (globals.css) and convert all theme module tokens to reference CSS custom properties instead of inline Tailwind classes.
   
   **Recommendation: Option A** — Tailwind v4 is the framework's native styling system, and the `@/theme` module structure is clean and composable.

### Long-term

7. **Consolidate component-level hardcoded colors** by gradually sweeping the ~80 offending files. Start with the most-used components (audit logs, inventory, products, rentals).

8. **Define a shadow scale** in the theme system (e.g., `shadows.card`, `shadows.panel`, `shadows.modal`, `shadows.input`) so every component doesn't pick its own arbitrary shadow.

---

## 8. Quick Wins File List

| File | Fix |
|------|-----|
| `globals.css` (truncate override) | Remove `.truncate` and `.line-clamp` overrides |
| `globals.css` (button:active) | Remove global button:active translate/shadow |
| `AuditFilters.tsx` `.focus:border-blue-400` | Replace with `focus:border-[#7a9a5e]/40` or theme focus token |
| `SelectField.tsx` `.focus:border-blue-400` | Same |
| `AuditDetails.tsx` `bg-white/60` | Replace with `surfaces.card` or `glass.card` |
| `badges.ts` | Remove — move all badge defs to `colors.ts` |
| `glass.ts` badge definitions | Remove — re-export from `colors.ts` |
| `surfaces.ts` alert definitions | Remove — re-export from `colors.ts` |
| `orderStatus.ts` hex colors | Replace with Tailwind equivalents or CSS variable refs |
| All `bg-slate-950` inline | Replace with `colors.app` equivalent |
| All `text-cyan-*` / `bg-cyan-*` inline | Replace with sage green equivalents |
| All `iconTheme` in `providers.tsx` | Replace `#22c55e` / `#ef4444` with theme token refs |

---

## 9. Summary Statistics

| Metric | Count |
|--------|-------|
| Files with hardcoded color classes (non-theme-module) | ~80 |
| Distinct gray palettes | 7 |
| Distinct accent color families | 6 |
| Redundant badge/semantic definitions | 4 |
| Theme modules | 18 |
| Files using glass tokens correctly | < 5 |
| Files using surfaces tokens correctly | < 10 |
| Files using colors tokens correctly | < 3 |

---

## Appendix: Offending Color Patterns Found by regex

| Pattern | Count | Example |
|---------|-------|---------|
| `text-slate-*` (inline) | ~250 | `text-slate-300`, `text-slate-400`, `text-slate-600` |
| `text-zinc-*` (inline) | ~60 | `text-zinc-300`, `text-zinc-400`, `text-zinc-500` |
| `text-neutral-*` (inline) | ~40 | `text-neutral-300`, `text-neutral-400` |
| `text-cyan-*` (inline) | ~80 | `text-cyan-200`, `text-cyan-100`, `text-cyan-50` |
| `bg-cyan-*` (inline) | ~40 | `bg-cyan-300`, `bg-cyan-400`, `bg-cyan-500` |
| `border-cyan-*` (inline) | ~30 | `border-cyan-300`, `border-cyan-400` |
| `bg-white/*` (inline) | ~100 | `bg-white/10`, `bg-white/[0.06]`, `bg-white/[0.055]` |
| `border-white/*` (inline) | ~80 | `border-white/10`, `border-white/50` |
| `shadow-2xl shadow-black/*` (inline) | ~30 | `shadow-2xl shadow-black/20`, `shadow-2xl shadow-black/30` |
| `text-white` (inline, not in theme token) | ~80 | Every component re-declaring text-white |
| `text-\[#.*\]` (inline) | ~100 | Hardcoded hex in component files |
| `bg-\[#.*\]` (inline) | ~80 | Hardcoded hex backgrounds outside theme modules |
| `ring-cyan-*` | ~15 | Cyan focus rings |
| `ring-blue-*` | ~3 | Blue focus rings (imported from old patterns) |
| `ring-sky-*` | ~5 | Sky focus rings |
| `bg-sky-*` | ~10 | Sky backgrounds |
| `bg-amber-*` | ~20 | Amber warning backgrounds |
| `bg-emerald-*` | ~25 | Emerald success backgrounds |
| `bg-rose-*` | ~15 | Rose danger backgrounds |
