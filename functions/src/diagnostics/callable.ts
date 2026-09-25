import {getApps, initializeApp} from "firebase-admin/app";
import {HttpsError, onCall} from "firebase-functions/v2/https";

import {requireCallableAdmin} from "../auth/roles.js";
import {enforceCallableRateLimit} from "../security/rateLimit.js";
import {writeDiagnosticAudit} from "./audit.js";
import {diagnosticEvidence} from "./evidence.js";
import {runDiagnosticRequest} from "./service.js";
import {DiagnosticError, type DiagnosticRequest, type DiagnosticResult, type DiagnosticTool} from "./types.js";

if (!getApps().length) {
  initializeApp();
}

function parseDiagnosticRequest(data: unknown): DiagnosticRequest {
  const tool = (data as {tool?: unknown})?.tool;
  const params = (data as {params?: unknown})?.params;

  if (
    tool !== "repo_status" &&
    tool !== "repo_search" &&
    tool !== "repo_read" &&
    tool !== "function_describe" &&
    tool !== "function_logs"
  ) {
    throw new HttpsError("invalid-argument", "Unknown diagnostic tool.");
  }

  if (tool === "repo_status") {
    return {tool};
  }

  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new HttpsError("invalid-argument", "Diagnostic params must be an object.");
  }

  return {tool, params: params as never} as DiagnosticRequest;
}

function paramsForAudit(request: DiagnosticRequest): Record<string, unknown> {
  return request.params ? {...request.params} : {};
}

async function dispatchDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResult> {
  return runDiagnosticRequest(request);
}

function rejectedResult(tool: DiagnosticTool, error: DiagnosticError): DiagnosticResult {
  return {
    tool,
    evidence: diagnosticEvidence("REJECTED", "diagnostics_bridge", error.message),
    result: null,
    resultCount: 0,
  } as DiagnosticResult;
}

export const jarvisDiagnosticsCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (callableRequest) => {
    await enforceCallableRateLimit(callableRequest, "admin");
    await requireCallableAdmin(callableRequest.auth, "Admin or Tank access required.");

    const actorUid = callableRequest.auth?.uid;
    if (!actorUid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const diagnosticRequest = parseDiagnosticRequest(callableRequest.data);
    const auditParams = paramsForAudit(diagnosticRequest);

    try {
      const result = await dispatchDiagnostic(diagnosticRequest);
      await writeDiagnosticAudit({
        actorUid,
        tool: diagnosticRequest.tool,
        params: auditParams,
        success: true,
        resultCount: result.resultCount,
      });
      return result;
    } catch (error) {
      if (error instanceof DiagnosticError) {
        const result = rejectedResult(diagnosticRequest.tool, error);
        await writeDiagnosticAudit({
          actorUid,
          tool: diagnosticRequest.tool,
          params: auditParams,
          success: false,
          resultCount: 0,
        });
        return result;
      }

      await writeDiagnosticAudit({
        actorUid,
        tool: diagnosticRequest.tool,
        params: auditParams,
        success: false,
        resultCount: 0,
      });

      throw new HttpsError("internal", "Diagnostic tool failed.");
    }
  },
);
