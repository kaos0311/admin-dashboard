import { ProductRepository } from "@/repositories/firestore/product.repository";

export type ProductAuditAction =
  | "create"
  | "update"
  | "soft-delete"
  | "bulk-soft-delete";

export async function writeProductAuditLog(args: {
  action: ProductAuditAction;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  count?: number;
  user?: {
    uid?: string | null;
    email?: string | null;
  } | null;
}) {
  try {
    await ProductRepository.writeAuditLog({
      entityType: "product",
      action: args.action,
      entityId: args.entityId ?? null,
      count: args.count ?? null,
      before: args.before ?? null,
      after: args.after ?? null,
      userId: args.user?.uid ?? null,
      userEmail: args.user?.email ?? null,
      actorUid: args.user?.uid ?? null,
      actorEmail: args.user?.email ?? null,
    });
  } catch (error) {
    console.warn("PRODUCT AUDIT LOG WRITE FAILED:", error);
  }
}
