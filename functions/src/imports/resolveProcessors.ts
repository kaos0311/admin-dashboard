import { REPORT_REGISTRY } from "./reportRegistry";
import type { ProcessorName } from "./types/processorResult";
import type { ImportRow } from "./types/stagingChunk";

export function resolveProcessors(
  fileName: string,
  reportType: string | undefined,
  rows: ImportRow[]
): ProcessorName[] {
  const headers = Object.keys(rows[0] ?? {}).join(" ").toLowerCase();

  if (
    reportType === "hospice" &&
    (headers.includes("clinical dod") || headers.includes("patient nursing agency"))
  ) {
    return ["hospice"];
  }

  const explicit = REPORT_REGISTRY.find((entry) => entry.type === reportType);
  if (explicit) return explicit.processors;

  const lowerName = fileName.toLowerCase();
  const shopByFileName = REPORT_REGISTRY.find(
    (entry) =>
      entry.type === "shop" &&
      entry.filenameKeywords.some((keyword) => lowerName.includes(keyword))
  );

  if (shopByFileName) return shopByFileName.processors;

  const scored = REPORT_REGISTRY.map((entry) => {
    const filenameScore = entry.filenameKeywords.filter((keyword) =>
      lowerName.includes(keyword)
    ).length * 3;

    const headerScore = entry.headerKeywords.filter((keyword) =>
      headers.includes(keyword)
    ).length;

    return { entry, score: filenameScore + headerScore };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].entry.processors : ["patients"];
}
