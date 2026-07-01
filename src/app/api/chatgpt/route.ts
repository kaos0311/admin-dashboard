import { NextRequest, NextResponse } from "next/server";
import { verifyChatGptApiKey } from "@/lib/chatgpt-bridge/auth";
import {
  executeQuery,
  getCollectionsSummary,
  getDocument,
  type QueryOptions,
} from "@/lib/chatgpt-bridge/queries";

export const runtime = "nodejs";

/**
 * Main GPT Actions endpoint for ChatGPT.
 *
 * Modes:
 *   "query"       — Query a Firestore collection (filter, sort, limit)
 *   "document"    — Get a single document by ID
 *   "collections" — List available collections and their schemas
 *   "ask"         — Send a natural-language prompt to the existing Jarvis AI
 */
export async function POST(request: NextRequest) {
  const auth = verifyChatGptApiKey(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      mode: string;
      collection?: string;
      docId?: string;
      prompt?: string;
      limit?: number;
      orderByField?: string;
      orderDirection?: "asc" | "desc";
      filters?: QueryOptions["filters"];
    };

    const mode = body.mode;

    switch (mode) {
      case "collections": {
        const result = await getCollectionsSummary();
        return NextResponse.json(result);
      }

      case "query": {
        if (!body.collection) {
          return NextResponse.json(
            { error: "collection is required for query mode." },
            { status: 400 }
          );
        }

        const result = await executeQuery({
          collection: body.collection as QueryOptions["collection"],
          limit: body.limit,
          orderByField: body.orderByField,
          orderDirection: body.orderDirection,
          filters: body.filters,
        });

        return NextResponse.json(result);
      }

      case "document": {
        if (!body.collection || !body.docId) {
          return NextResponse.json(
            { error: "collection and docId are required for document mode." },
            { status: 400 }
          );
        }

        const result = await getDocument(
          body.collection as QueryOptions["collection"],
          body.docId
        );

        return NextResponse.json(result);
      }

      case "ask": {
        if (!body.prompt) {
          return NextResponse.json(
            { error: "prompt is required for ask mode." },
            { status: 400 }
          );
        }

        // Ask mode is only available when ASK_ADMIN_AI_URL is configured.
        // This endpoint proxies to the existing askAdminAi Firebase Cloud Function.
        // Set ASK_ADMIN_AI_URL to the function's HTTPS trigger URL.
        const functionUrl = process.env.ASK_ADMIN_AI_URL;
        if (!functionUrl) {
          return NextResponse.json(
            {
              error:
                "ASK_ADMIN_AI_URL is not configured. The 'ask' mode requires a deployed Cloud Function URL. Use 'query' mode to retrieve raw data instead.",
            },
            { status: 501 }
          );
        }

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { prompt: body.prompt.trim() } }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json(
            { error: `AI function error: ${response.status} — ${errorText.slice(0, 500)}` },
            { status: 502 }
          );
        }

        const result = (await response.json()) as {
          result?: { answer?: string; intent?: string; collectionsUsed?: string[] };
          error?: { message?: string };
        };

        if (result.error?.message) {
          return NextResponse.json({ error: result.error.message }, { status: 502 });
        }

        return NextResponse.json({
          answer: result.result?.answer ?? "",
          intent: result.result?.intent ?? null,
          collectionsUsed: result.result?.collectionsUsed ?? [],
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown mode "${mode}". Supported modes: query, document, collections, ask.`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
