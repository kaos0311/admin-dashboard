import { NextResponse } from "next/server";

/**
 * Serves the OpenAPI 3.1 spec for the ChatGPT GPT Actions bridge.
 * ChatGPT imports this URL when configuring a Custom GPT action.
 */
export async function GET() {
  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Advanced Home Medical - Database Bridge",
      version: "1.0.0",
      description:
        "Query your Firestore database from ChatGPT. " +
        "Supports reading collections, filtering documents, " +
        "and asking natural-language questions via Jarvis AI.",
    },
    servers: [
      {
        url: host,
        description: "Production / local server",
      },
    ],
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    paths: {
      "/api/chatgpt": {
        post: {
          summary: "Query the database or ask Jarvis AI",
          description:
            "Main endpoint for all GPT Actions operations. " +
            "Use the `mode` field to select the operation:\n\n" +
            "- **collections**: List all available collections with field descriptions.\n" +
            "- **query**: Query a collection with filters, sorting, and limits.\n" +
            "- **document**: Fetch a single document by collection + doc ID.\n" +
            "- **ask**: Send a natural-language prompt to the Jarvis AI assistant.\n\n" +
            "Start every session by calling `collections` to understand the available data structure.",
          operationId: "queryDatabase",
          parameters: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["mode"],
                  properties: {
                    mode: {
                      type: "string",
                      enum: ["collections", "query", "document", "ask"],
                      description:
                        "Operation to perform:\n" +
                        "- `collections`: List available collections.\n" +
                        "- `query`: Search/filter a collection.\n" +
                        "- `document`: Get one document by ID.\n" +
                        "- `ask`: Ask Jarvis AI a natural-language question.",
                      example: "collections",
                    },
                    collection: {
                      type: "string",
                      description:
                        "Collection name (required for query and document modes). " +
                        "Get the full list by calling mode=collections first.",
                      example: "orders",
                    },
                    docId: {
                      type: "string",
                      description:
                        "Document ID (required for document mode).",
                      example: "abc123",
                    },
                    prompt: {
                      type: "string",
                      maxLength: 4000,
                      description:
                        "Natural-language question (required for ask mode). " +
                        "Example: 'How many orders are pending fulfillment?'",
                      example:
                        "Summarize today's high-risk audit activity and identify operational concerns.",
                    },
                    limit: {
                      type: "integer",
                      minimum: 1,
                      maximum: 100,
                      default: 50,
                      description: "Maximum documents to return (1-100).",
                    },
                    orderByField: {
                      type: "string",
                      description:
                        "Field to sort results by. Example: createdAt",
                    },
                    orderDirection: {
                      type: "string",
                      enum: ["asc", "desc"],
                      default: "desc",
                      description: "Sort direction.",
                    },
                    filters: {
                      type: "array",
                      description:
                        "Array of filter conditions (all applied with AND logic). " +
                        "Example: [{ field: 'status', operator: '==', value: 'pending' }]",
                      items: {
                        type: "object",
                        required: ["field", "operator", "value"],
                        properties: {
                          field: {
                            type: "string",
                            description:
                              "Field name in the document. Use dot notation for nested fields.",
                          },
                          operator: {
                            type: "string",
                            enum: [
                              "==",
                              "!=",
                              ">",
                              ">=",
                              "<",
                              "<=",
                              "array-contains",
                            ],
                            description: "Firestore query operator.",
                          },
                          value: {
                            description:
                              "Value to filter by. Can be string, number, or boolean.",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful response.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      collections: {
                        type: "array",
                        description:
                          "Only present in collections mode. Array of collection metadata.",
                      },
                      collection: {
                        type: "string",
                        description:
                          "Collection name (query mode).",
                      },
                      count: {
                        type: "integer",
                        description:
                          "Number of documents returned (query mode).",
                      },
                      docs: {
                        type: "array",
                        description:
                          "Document array (query mode).",
                      },
                      doc: {
                        type: "object",
                        description:
                          "Single document (document mode).",
                      },
                      answer: {
                        type: "string",
                        description:
                          "AI response text (ask mode).",
                      },
                      error: {
                        type: "string",
                        description:
                          "Error message if the request failed.",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request — missing or invalid parameters.",
            },
            "401": {
              description: "Unauthorized — missing or invalid API key.",
            },
            "502": {
              description: "Bad gateway — AI function error.",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description:
            "Enter: Bearer <your-chatgpt-api-key>. " +
            "The key must match the CHATGPT_API_KEY environment variable on the server.",
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
