"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { DEFAULT_BRIGHTREE_REFERENCES } from "@/app/(dashboard)/settings/brightree-reference-data";
import { normalizeBrightreeReferences } from "@/app/(dashboard)/settings/settings-utils";
import type { BrightreeReferenceSettings } from "@/app/(dashboard)/settings/settings-types";

export function useBrightreeReferences() {
  const [references, setReferences] = useState<BrightreeReferenceSettings>(
    DEFAULT_BRIGHTREE_REFERENCES
  );

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "app"),
      (snapshot) => {
        const data = snapshot.exists()
          ? (snapshot.data() as Record<string, unknown>)
          : {};

        const source =
          typeof data.brightreeReferences === "object" &&
          data.brightreeReferences !== null
            ? (data.brightreeReferences as Record<string, unknown>)
            : undefined;

        setReferences(normalizeBrightreeReferences(source));
      },
      () => {
        setReferences(DEFAULT_BRIGHTREE_REFERENCES);
      }
    );
  }, []);

  return useMemo(() => references, [references]);
}

