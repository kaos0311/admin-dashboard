export const navigation = {
  sidebarShell:
    "hidden w-64 shrink-0 border-r border-[#3a3a3a] bg-[#141414] text-[#ececec] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex",

  mobileOverlay:
    "fixed inset-0 z-50 lg:hidden",

  mobileBackdrop:
    "absolute inset-0 bg-black/70",

  mobileShell:
    "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[#3a3a3a] bg-[#141414] text-[#ececec] shadow-2xl",

  mobileHeader:
    "flex items-center justify-between border-b border-[#3a3a3a] px-4 py-4",

  brandCard:
    "mb-4 rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] px-4 py-5 shadow-lg shadow-black/25",

  inner:
    "flex h-full w-full flex-col p-3",

  scrollArea:
    "custom-sidebar-scroll flex flex-1 flex-col overflow-y-auto pr-1",

  section:
    "mb-5",

  sectionLabel:
    "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#888888]",

  sectionStack:
    "flex flex-col gap-1",

  itemBase:
    "group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200",

  itemActive:
    "border-[#7a9a5e]/40 bg-[#5a7a3e]/20 text-[#ececec] shadow-inner shadow-black/25",

  itemInactive:
    "border-[#2a2a2a] bg-[#1a1a1a] text-[#888888] hover:border-[#3a3a3a] hover:bg-[#222222] hover:text-[#ececec]",

  iconBase:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",

  iconActive:
    "border-[#7a9a5e]/40 bg-[#5a7a3e]/20 text-[#ececec]",

  iconInactive:
    "border-[#2a2a2a] bg-[#222222] text-[#606060] group-hover:border-[#3a3a3a] group-hover:bg-[#2a2a2a] group-hover:text-[#ececec]",

  closeButton:
    "rounded-xl border border-[#3a3a3a] bg-[#222222] p-2 text-[#ececec] transition hover:border-[#5a5a5a] hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-[#7a9a5e]/40",

  activeDot:
    "h-2 w-2 rounded-full bg-[#9aba7e]",

  inactiveDot:
    "h-2 w-2 rounded-full bg-transparent transition group-hover:bg-[#606060]",

  badge:
    "rounded-full border border-[#b84a4a]/25 bg-[#b84a4a]/10 px-2 py-0.5 text-[10px] text-[#d47a7a]",

  health:
    "mt-3 rounded-2xl border border-[#6a9a6a]/25 bg-[#6a9a6a]/10 px-4 py-3 text-xs text-[#8aba8a]",
};
