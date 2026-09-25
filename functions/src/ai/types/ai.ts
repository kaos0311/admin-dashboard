/**
 * Shared AI/Jarvis domain types.
 * Previously an empty scaffold; populated from the shapes used by
 * askAdminAi so callers and future refactors share one source of truth.
 */

export type JarvisIntent =
  | "dme-deals-web-search"
  | "insurance-web-search"
  | "analysis-reporting"
  | "phi-risk"
  | "imports"
  | "audit"
  | "api-registry"
  | "orders"
  | "rentals"
  | "inventory"
  | "hospice"
  | "insurance"
  | "general";

export interface AskAdminAiRequestData {
  prompt: string;
}

export interface AskAdminAiResponseData {
  answer: string;
  intent: JarvisIntent;
  collectionsUsed: string[];
  reportArtifact: ReportArtifact | null;
  memoryLogged: boolean;
  phiRisk: {
    promptFindings: number;
    responseFindings: number;
    alertIds: string[];
  };
}

export interface ReportArtifact {
  type: "csv";
  fileName: string;
  title: string;
  content: string;
}

export interface AiInteractionLogEntry {
  actorUid: string;
  actorEmail: string | null;
  prompt: string;
  intent: JarvisIntent;
  model: string;
  responseLength: number;
  collectionsUsed: string[];
  promptPhiFindingCount: number;
  responsePhiFindingCount: number;
  phiAlertIds: string[];
  reportArtifactCreated: boolean;
}