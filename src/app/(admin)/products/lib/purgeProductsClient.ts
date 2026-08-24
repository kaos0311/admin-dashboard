export const PURGE_PRODUCTS_CONFIRM_TEXT = "PURGE PRODUCTS" as const;

export type PurgeProductsRequest = {
  confirmText: string;
};

export type PurgeProductsResult = {
  status: "success";
  deletedCount: number;
};

export type PurgeProductsCallable = (
  payload: PurgeProductsRequest,
) => Promise<{
  data: PurgeProductsResult;
}>;

export async function executePurgeProducts(
  callable: PurgeProductsCallable,
  confirmText: string,
): Promise<PurgeProductsResult> {
  const response = await callable({
    confirmText,
  });

  return response.data;
}
