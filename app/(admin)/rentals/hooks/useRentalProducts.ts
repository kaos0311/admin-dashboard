"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PRODUCTS_COLLECTION } from "../rentals-constants";
import type { RentalProductOption } from "../rentals-types";
import { normalizeRentalProductOption } from "../utils/normalize";

export function useRentalProducts() {
  const [products, setProducts] = useState<RentalProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const productsQuery = query(
      collection(db, PRODUCTS_COLLECTION),
      orderBy("name", "asc")
    );

    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const nextProducts = snapshot.docs
          .map((docSnap) =>
            normalizeRentalProductOption(
              docSnap.id,
              docSnap.data() as Record<string, unknown>
            )
          )
          .filter((product) => product.rentalEligible);

        setProducts(nextProducts);
        setLoading(false);
      },
      () => {
        setProducts([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { products, loading };
}
