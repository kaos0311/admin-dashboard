/**
 * Identifies an inventory product via the Jarvis product-enrichment API.
 *
 * Fetches an auth token from the current user, POSTs to the API with the
 * inventory ID and scanned / manual code, and returns the enriched product
 * data if a match is found.
 *
 * This service does not call toast, update React state, or import any
 * page-level components. It is responsible only for authentication
 * and calling the Jarvis product enrichment API.
 */
export async function identifyInventoryProduct(params: {
  currentUser: import("firebase/auth").User;
  inventoryId: string;
  code: string;
}): Promise<{
  ok: boolean;
  error?: string;
  product?: {
    name?: string;
    category?: string;
    sku?: string;
    barcode?: string;
    manufacturer?: string;
    modelNumber?: string;
  };
}> {
  const { currentUser, inventoryId, code } = params;

  const token = await currentUser.getIdToken();

  const response = await fetch("/api/jarvis/product-enrichment", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mode: "identifyInventory",
      inventoryId,
      code,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    product?: {
      name?: string;
      category?: string;
      sku?: string;
      barcode?: string;
      manufacturer?: string;
      modelNumber?: string;
    };
  };

  if (!response.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  if (result.ok === false || !result.product) {
    return {
      ok: false,
      error: result.error,
    };
  }

  return {
    ok: true,
    product: result.product,
  };
}
