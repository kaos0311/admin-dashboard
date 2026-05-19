"use client";

import { ImageIcon } from "lucide-react";

import type { Product } from "../utils/productTypes";

export function ProductThumb({ product }: { product: Product }) {
  const src = product.thumbnailUrl || product.imageUrl;

  if (!src) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-500 shadow-inner shadow-black/20">
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-12 w-12 shrink-0 rounded-2xl border border-white/10 object-cover shadow-lg shadow-black/30"
    />
  );
}