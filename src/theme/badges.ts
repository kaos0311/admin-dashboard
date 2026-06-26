export const badges = {
  success:
    "border border-[#6a9a6a]/30 bg-[#6a9a6a]/10 text-[#8aba8a]",

  warning:
    "border border-[#c49a4a]/30 bg-[#c49a4a]/10 text-[#d4b86a]",

  danger:
    "border border-[#b84a4a]/30 bg-[#b84a4a]/10 text-[#d47a7a]",

  info:
    "border border-[#7a9a5e]/30 bg-[#7a9a5e]/10 text-[#9aba7e]",

  neutral:
    "border border-[#3a3a3a] bg-[#222222] text-[#b8b8b8]",

  active:
    "border border-[#8aaa6e]/30 bg-[#8aaa6e]/10 text-[#9aba7e]",

  kpiCard: {
    neutral: "border-[#3a3a3a] bg-[#1c1c1c] text-[#ececec]",
    cyan: "border-[#7a9a5e]/30 bg-[#7a9a5e]/10 text-[#9aba7e]",
    red: "border-[#b84a4a]/30 bg-[#b84a4a]/10 text-[#d47a7a]",
    emerald: "border-[#6a9a6a]/30 bg-[#6a9a6a]/10 text-[#8aba8a]",
    yellow: "border-[#c49a4a]/30 bg-[#c49a4a]/10 text-[#d4b86a]",
  },

  kpiIcon: {
    neutral: "border-[#3a3a3a] bg-[#222222] text-[#888888]",
    cyan: "border-[#7a9a5e]/25 bg-[#7a9a5e]/10 text-[#9aba7e]",
    red: "border-[#b84a4a]/25 bg-[#b84a4a]/10 text-[#d47a7a]",
    emerald: "border-[#6a9a6a]/25 bg-[#6a9a6a]/10 text-[#8aba8a]",
    yellow: "border-[#c49a4a]/25 bg-[#c49a4a]/10 text-[#d4b86a]",
  },

  pulseDot:
    "h-2 w-2 animate-pulse rounded-full bg-[#9aba7e] shadow-[0_0_8px_rgba(154,186,126,0.6)]",

} as const;

export type BadgeKey = keyof typeof badges;
