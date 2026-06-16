"use client";

import { typography } from "@/theme";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

import type { Product } from "../utils/productTypes";

export function ProductThumb({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);

  const src = product.thumbnailUrl || product.imageUrl;
  const productName = product.name || "Product";

  if (!src || failed) {
    return (
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] ${typography.caption} shadow-inner shadow-black/20`}>
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">No image available for {productName}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${productName} image`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 object-cover shadow-lg shadow-black/30"
    />
  );
}



