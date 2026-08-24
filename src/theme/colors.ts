export const colors = {
  /* ---- Background ---- */
  app:
    "bg-[#121212] text-[#e6e6e6]",

  adminShell:
    "bg-[#121212] text-[#e6e6e6]",

  /* ---- Text ---- */
  textPrimary: "text-[#e6e6e6]",
  textSecondary: "text-[#b8b8b8]",
  textMuted: "text-[#888888]",
  textFaint: "text-[#606060]",
  textInverse: "text-[#121212]",
  textDisabled: "text-[#e6e6e6]/40",
  textInfo: "text-[#7a9a5e]",
  textSuccess: "text-[#6a9a6a]",
  textWarning: "text-[#c49a4a]",
  textDanger: "text-[#b84a4a]",

  /* ---- Borders ---- */
  border: "border-[#3a3a3a]",
  borderStrong: "border-[#4a4a4a]",
  borderMuted: "border-[#2a2a2a]",

  /* ---- Surfaces ---- */
  surface:
    "bg-[#1c1c1c]",
  surfaceHover:
    "hover:bg-[#242424]",
  surfaceStrong:
    "bg-[#2a2a2a]",
  surfaceInset:
    "bg-[#161616] shadow-inner shadow-black/20",

  surfaceInput:
    "bg-[#1a1a1a]",
  surfaceInputFocus:
    "focus:bg-[#202020]",

  /* ---- Overlay ---- */
  overlay:
    "bg-black/70",

  /* ---- Decorative backgrounds ---- */
  grid:
    "pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-15",

  vignette:
    "pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.18)_70%,rgba(0,0,0,0.3)_100%)]",

  /* ---- Shadows ---- */
  shadow:
    "shadow-xl shadow-black/15",
  shadowStrong:
    "shadow-2xl shadow-black/25",

  /* ---- Semantic colors ---- */
  success:
    "border-[#6a9a6a]/30 bg-[#6a9a6a]/10 text-[#8aba8a]",
  warning:
    "border-[#c49a4a]/30 bg-[#c49a4a]/10 text-[#d4b86a]",
  warningBanner:
    "border-[#c49a4a]/15 bg-[#c49a4a]/8 text-[#d4b86a]",
  danger:
    "border-[#b84a4a]/30 bg-[#b84a4a]/10 text-[#d47a7a]",
  info:
    "border-[#7a9a5e]/30 bg-[#7a9a5e]/10 text-[#9aba7e]",
  neutral:
    "border-[#3a3a3a] bg-[#1c1c1c] text-[#b8b8b8]",

  /* ---- Badges ---- */
  successBadge:
    "border-[#6a9a6a]/30 bg-[#6a9a6a]/10 text-[#8aba8a]",
  warningBadge:
    "border-[#c49a4a]/30 bg-[#c49a4a]/10 text-[#d4b86a]",
  dangerBadge:
    "border-[#b84a4a]/30 bg-[#b84a4a]/10 text-[#d47a7a]",
  infoBadge:
    "border-[#7a9a5e]/30 bg-[#7a9a5e]/10 text-[#9aba7e]",
  neutralBadge:
    "border-[#3a3a3a] bg-[#1c1c1c] text-[#b8b8b8]",
  activeBadge:
    "border-[#8aaa6e]/30 bg-[#8aaa6e]/10 text-[#9aba7e]",

  /* ---- Pulse dots ---- */
  pulse:
    "bg-[#7a9a5e]",
  dangerPulse:
    "bg-[#b84a4a]",
  successPulse:
    "bg-[#6a9a6a]",
} as const;

export type ColorKey = keyof typeof colors;
