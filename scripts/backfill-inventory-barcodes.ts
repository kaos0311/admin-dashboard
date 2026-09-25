/**
 * Backfill script to add barcode values to inventory items.
 *
 * This script reads all inventory items that have a `barcode` field that is
 * empty, and attempts to populate it from the `products` collection via
 * SKU, HCPCS, or manufacturer item ID matching.
 *
 * Usage:
 *   npx tsx scripts/backfill-inventory-barcodes.ts
 *
 * Environment:
 *   - Requires firebase-admin service account key at project root
 *   - Reads from the production Firestore database
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

type ServiceAccountFile = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

function loadServiceAccount() {
  const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  const raw = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as ServiceAccountFile;

  return {
    projectId: raw.project_id ?? raw.projectId ?? "",
    clientEmail: raw.client_email ?? raw.clientEmail ?? "",
    privateKey: raw.private_key ?? raw.privateKey ?? "",
  };
}

if (!getApps().length) {
  const serviceAccount = loadServiceAccount();
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

const db = getFirestore();

interface ProductDoc {
  id: string;
  name: string;
  sku: string;
  upc: string;
  hcpcs: string;
  manufacturerItemId: string;
  manufacturer: string;
  [key: string]: unknown;
}

async function run() {
  console.log("Starting inventory barcode backfill...\n");

  // Load all products for reference
  const productsSnap = await db.collection("products").get();
  const products: ProductDoc[] = [];
  productsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (data.deleted === true) return;
    products.push({
      id: doc.id,
      name: String(data.name ?? ""),
      sku: String(data.sku ?? ""),
      upc: String(data.upc ?? ""),
      hcpcs: String(data.hcpcs ?? ""),
      manufacturerItemId: String(data.manufacturerItemId ?? ""),
      manufacturer: String(data.manufacturer ?? ""),
    });
  });
  console.log(`Loaded ${products.length} products.\n`);

  // Create lookup maps
  const skuToProduct = new Map<string, ProductDoc>();
  const upcToProduct = new Map<string, ProductDoc>();
  const hcpcsToProduct = new Map<string, ProductDoc>();
  const manufacturerItemIdToProduct = new Map<string, ProductDoc>();

  for (const product of products) {
    if (product.sku) skuToProduct.set(product.sku.toLowerCase(), product);
    if (product.upc) upcToProduct.set(product.upc, product);
    if (product.hcpcs) hcpcsToProduct.set(product.hcpcs.toUpperCase(), product);
    if (product.manufacturerItemId) manufacturerItemIdToProduct.set(product.manufacturerItemId.toLowerCase(), product);
  }

  // Load inventory items
  const inventorySnap = await db.collection("inventory").get();
  let backfilled = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of inventorySnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const id = doc.id;

    // Skip if already has a barcode
    const existingBarcode = String(data.barcode ?? "").trim();
    if (existingBarcode) {
      skipped++;
      continue;
    }

    const sku = String(data.sku ?? "").trim();
    const hcpcs = String(data.hcpcs ?? "").trim().toUpperCase();
    const manufacturerItemId = String(data.manufacturerItemId ?? "").trim();
    const productId = String(data.productId ?? "").trim();

    let matchedProduct: ProductDoc | null = null;
    let matchField = "";

    // Try direct productId match
    if (productId) {
      const product = products.find((p) => p.id === productId);
      if (product && product.upc) {
        matchedProduct = product;
        matchField = "productId";
      }
    }

    // Try SKU match
    if (!matchedProduct && sku) {
      const product = skuToProduct.get(sku.toLowerCase());
      if (product && product.upc) {
        matchedProduct = product;
        matchField = "sku";
      }
    }

    // Try HCPCS match
    if (!matchedProduct && hcpcs) {
      const product = hcpcsToProduct.get(hcpcs);
      if (product && product.upc) {
        matchedProduct = product;
        matchField = "hcpcs";
      }
    }

    // Try manufacturer item ID match
    if (!matchedProduct && manufacturerItemId) {
      const product = manufacturerItemIdToProduct.get(manufacturerItemId.toLowerCase());
      if (product && product.upc) {
        matchedProduct = product;
        matchField = "manufacturerItemId";
      }
    }

    if (matchedProduct) {
      try {
        await db.collection("inventory").doc(id).update({
          barcode: matchedProduct.upc,
          updatedAt: new Date(),
        });
        console.log(`BACKFILLED [${matchField}] ${id}: ${matchedProduct.name} -> ${matchedProduct.upc}`);
        backfilled++;
      } catch (err) {
        console.error(`ERROR updating ${id}:`, err);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Backfilled: ${backfilled}, Skipped: ${skipped}, Errors: ${errors}`);
}

run().catch(console.error);
