export const orderStatusStyles = {
  processing: "border-[#7a9a5e]/25 bg-[#7a9a5e]/10 text-[#9aba7e]",
  ready: "border-[#8aaa6e]/25 bg-[#8aaa6e]/10 text-[#9aba7e]",
  delivered: "border-[#6a9a6a]/25 bg-[#6a9a6a]/10 text-[#8aba8a]",
  cancelled: "border-[#b84a4a]/25 bg-[#b84a4a]/10 text-[#d47a7a]",
  archived: "border-[#606060]/20 bg-[#606060]/10 text-[#b8b8b8]",
} as const;

export const orderStatusLabels = {
  processing: "Processing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
  archived: "Archived",
} as const;
