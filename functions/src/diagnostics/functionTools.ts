import {
  ALLOWED_FUNCTIONS,
  DEFAULT_LOG_RESULTS,
  DIAGNOSTICS_PROJECT_ID,
  DIAGNOSTICS_REGION,
  MAX_LOG_MINUTES,
  MAX_LOG_RESULTS,
} from "./config.js";
import {diagnosticEvidence} from "./evidence.js";
import {redactDiagnosticText} from "./redaction.js";
import {
  type DiagnosticEnvelope,
  DiagnosticError,
  type FunctionDescribeResult,
  type FunctionLogEntry,
  type FunctionLogsResult,
} from "./types.js";

interface CloudFunctionResponse {
  name?: string;
  state?: string;
  updateTime?: string;
  buildConfig?: {
    runtime?: string;
    entryPoint?: string;
  };
  serviceConfig?: {
    uri?: string;
    service?: string;
    revision?: string;
    serviceRevision?: string;
  };
}

interface CloudRunServiceResponse {
  uri?: string;
  status?: {
    url?: string;
    latestReadyRevisionName?: string;
    latestCreatedRevisionName?: string;
  };
}

interface CloudLogEntryResponse {
  timestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  protoPayload?: Record<string, unknown>;
}

export interface CloudDiagnosticsClient {
  describeFunction(functionName: string): Promise<CloudFunctionResponse>;
  describeCloudRunService(functionName: string): Promise<CloudRunServiceResponse | null>;
  readFunctionLogs(functionName: string, minutes: number, limit: number): Promise<CloudLogEntryResponse[]>;
}

function assertAllowedFunction(functionName: unknown): string {
  if (typeof functionName !== "string" || !functionName.trim()) {
    throw new DiagnosticError("invalid-argument", "Function name is required.");
  }

  const cleanName = functionName.trim();
  if (!ALLOWED_FUNCTIONS.has(cleanName)) {
    throw new DiagnosticError("permission-denied", "Function is not allowlisted for diagnostics.");
  }

  return cleanName;
}

function boundedLogMinutes(minutes: unknown): number {
  const parsed = Number(minutes);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new DiagnosticError("invalid-argument", "Log minutes must be a positive integer.");
  }
  if (parsed > MAX_LOG_MINUTES) {
    throw new DiagnosticError("invalid-argument", `Log minutes exceeds ${MAX_LOG_MINUTES}.`);
  }
  return parsed;
}

function boundedLogLimit(limit: unknown): number {
  const parsed = limit === undefined ? DEFAULT_LOG_RESULTS : Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LOG_RESULTS;
  return Math.min(parsed, MAX_LOG_RESULTS);
}

async function getAccessToken(): Promise<string> {
  const response = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    {headers: {"Metadata-Flavor": "Google"}},
  );

  if (!response.ok) {
    throw new DiagnosticError("failed-precondition", "Google metadata token unavailable.");
  }

  const body = await response.json() as {access_token?: string};
  if (!body.access_token) {
    throw new DiagnosticError("failed-precondition", "Google metadata token response missing access token.");
  }
  return body.access_token;
}

async function googleApiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new DiagnosticError("failed-precondition", `Google API request failed with status ${response.status}.`);
  }

  return await response.json() as T;
}

export function createGoogleCloudDiagnosticsClient(): CloudDiagnosticsClient {
  return {
    async describeFunction(functionName: string): Promise<CloudFunctionResponse> {
      const resource = [
        "projects",
        DIAGNOSTICS_PROJECT_ID,
        "locations",
        DIAGNOSTICS_REGION,
        "functions",
        encodeURIComponent(functionName),
      ].join("/");
      return googleApiFetch<CloudFunctionResponse>(
        `https://cloudfunctions.googleapis.com/v2/${resource}`,
      );
    },

    async describeCloudRunService(functionName: string): Promise<CloudRunServiceResponse | null> {
      const serviceName = functionName.toLowerCase();
      const resource = [
        "projects",
        DIAGNOSTICS_PROJECT_ID,
        "locations",
        DIAGNOSTICS_REGION,
        "services",
        encodeURIComponent(serviceName),
      ].join("/");
      try {
        return await googleApiFetch<CloudRunServiceResponse>(
          `https://run.googleapis.com/v2/${resource}`,
        );
      } catch {
        return null;
      }
    },

    async readFunctionLogs(functionName: string, minutes: number, limit: number): Promise<CloudLogEntryResponse[]> {
      const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      const filter = [
        `resource.type="cloud_run_revision"`,
        `resource.labels.location="${DIAGNOSTICS_REGION}"`,
        `resource.labels.service_name="${functionName.toLowerCase()}"`,
        `timestamp>="${since}"`,
      ].join(" AND ");
      const response = await googleApiFetch<{entries?: CloudLogEntryResponse[]}>(
        "https://logging.googleapis.com/v2/entries:list",
        {
          method: "POST",
          body: JSON.stringify({
            resourceNames: [`projects/${DIAGNOSTICS_PROJECT_ID}`],
            filter,
            orderBy: "timestamp desc",
            pageSize: limit,
          }),
        },
      );
      return response.entries ?? [];
    },
  };
}

function getMessageFromLogEntry(entry: CloudLogEntryResponse): string {
  if (typeof entry.textPayload === "string") {
    return entry.textPayload;
  }

  const payload = entry.jsonPayload ?? entry.protoPayload ?? {};
  const safePayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("body") ||
      lowerKey.includes("payload") ||
      lowerKey.includes("env") ||
      lowerKey.includes("authorization") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("credential") ||
      lowerKey.includes("password")
    ) {
      safePayload[key] = "[REDACTED]";
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safePayload[key] = value;
    } else {
      safePayload[key] = "[COMPLEX_VALUE_REDACTED]";
    }
  }

  return JSON.stringify(safePayload);
}

function normalizeLogEntry(entry: CloudLogEntryResponse): FunctionLogEntry {
  return {
    timestamp: entry.timestamp ?? "",
    severity: entry.severity ?? "DEFAULT",
    message: redactDiagnosticText(getMessageFromLogEntry(entry)).slice(0, 1000),
  };
}

export async function functionDescribe(
  functionName: unknown,
  client: CloudDiagnosticsClient = createGoogleCloudDiagnosticsClient(),
): Promise<DiagnosticEnvelope<FunctionDescribeResult>> {
  const cleanName = assertAllowedFunction(functionName);
  const [response, cloudRunService] = await Promise.all([
    client.describeFunction(cleanName),
    client.describeCloudRunService(cleanName),
  ]);
  const latestReadyRevision =
    response.serviceConfig?.revision ??
    response.serviceConfig?.serviceRevision ??
    cloudRunService?.status?.latestReadyRevisionName ??
    cloudRunService?.status?.latestCreatedRevisionName ??
    null;
  const serviceUri =
    response.serviceConfig?.uri ??
    cloudRunService?.uri ??
    cloudRunService?.status?.url ??
    response.serviceConfig?.service ??
    null;

  const result: FunctionDescribeResult = {
    functionName: cleanName,
    runtime: response.buildConfig?.runtime ?? null,
    region: DIAGNOSTICS_REGION,
    state: response.state ?? null,
    entryPoint: response.buildConfig?.entryPoint ?? null,
    updateTime: response.updateTime ?? null,
    serviceUri,
    deployedRevision: latestReadyRevision,
  };

  return {
    tool: "function_describe",
    evidence: diagnosticEvidence("VERIFIED", "google_cloud_functions_v2_api"),
    result,
    resultCount: 1,
  };
}

export async function functionLogs(
  functionName: unknown,
  minutes: unknown,
  limit: unknown,
  client: CloudDiagnosticsClient = createGoogleCloudDiagnosticsClient(),
): Promise<DiagnosticEnvelope<FunctionLogsResult>> {
  const cleanName = assertAllowedFunction(functionName);
  const cleanMinutes = boundedLogMinutes(minutes);
  const cleanLimit = boundedLogLimit(limit);
  const entries = await client.readFunctionLogs(cleanName, cleanMinutes, cleanLimit);
  const normalizedEntries = entries.slice(0, cleanLimit).map(normalizeLogEntry);

  return {
    tool: "function_logs",
    evidence: diagnosticEvidence("VERIFIED", "google_cloud_logging_api"),
    result: {
      functionName: cleanName,
      minutes: cleanMinutes,
      entries: normalizedEntries,
      resultCount: normalizedEntries.length,
      truncated: entries.length > cleanLimit,
    },
    resultCount: normalizedEntries.length,
  };
}
