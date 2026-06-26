/**
 * ChatGPT GPT Actions Bridge
 *
 * Exposes Firestore data via a REST API that ChatGPT (Custom GPTs)
 * can call using GPT Actions / OpenAPI plugins.
 *
 * ## How to use
 *
 * 1. Deploy this Next.js app to production.
 * 2. Set the environment variable `CHATGPT_API_KEY` to a strong random string.
 * 3. (Optional) Set `ASK_ADMIN_AI_URL` to enable natural-language "ask" mode.
 * 4. In ChatGPT, create a Custom GPT → Configure → GPT Actions.
 * 5. Import the OpenAPI spec from `<your-domain>/api/chatgpt/openapi` or paste it.
 * 6. Set the API key auth in ChatGPT to the same `CHATGPT_API_KEY` value.
 * 7. Start asking questions about your database.
 */

export { verifyChatGptApiKey } from "./auth";
export {
  EXPOSED_COLLECTIONS,
  executeQuery,
  getDocument,
  getCollectionsSummary,
} from "./queries";
export type { QueryOptions } from "./queries";
