"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RadioTower,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";

import { buttons, colors, glass, typography } from "@/theme";
import { auth, db } from "@/lib/firebase";

import type { Product } from "../utils/productTypes";

type RecallMatch = {
  id: string;
  productId: string;
  productName: string;
  recallTitle: string;
  manufacturer: string;
  model: string;
  severity: string;
  status: string;
  actionRequired: string;
  sourceUrl: string;
};

type EquipmentRecall = {
  id: string;
  recallTitle: string;
  manufacturer: string;
  model: string;
  severity: string;
  actionRequired: string;
  sourceUrl: string;
};

type ProductRecallWatchProps = {
  products: Product[];
  canRead: boolean;
  canWrite: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefreshProducts?: () => void;
  onShowRecallProducts: () => void;
  onShowDiscontinuedProducts: () => void;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRecallMatch(
  id: string,
  data: Record<string, unknown>
): RecallMatch {
  return {
    id,
    productId: readString(data.productId) || readString(data.itemId),
    productName:
      readString(data.productName) ||
      readString(data.itemName) ||
      readString(data.name),
    recallTitle:
      readString(data.recallTitle) ||
      readString(data.title) ||
      readString(data.recallName),
    manufacturer: readString(data.manufacturer),
    model: readString(data.model),
    severity: readString(data.severity),
    status: readString(data.status),
    actionRequired:
      readString(data.actionRequired) ||
      readString(data.recommendedAction) ||
      readString(data.nextSteps) ||
      readString(data.instructions),
    sourceUrl: readString(data.sourceUrl) || readString(data.url),
  };
}

function normalizeEquipmentRecall(
  id: string,
  data: Record<string, unknown>
): EquipmentRecall {
  return {
    id,
    recallTitle:
      readString(data.recallTitle) ||
      readString(data.title) ||
      readString(data.recallName),
    manufacturer: readString(data.manufacturer),
    model: readString(data.model),
    severity: readString(data.severity),
    actionRequired:
      readString(data.actionRequired) ||
      readString(data.recommendedAction) ||
      readString(data.nextSteps) ||
      readString(data.instructions),
    sourceUrl: readString(data.sourceUrl) || readString(data.url),
  };
}

function matchRecallToProduct(match: RecallMatch, product: Product): boolean {
  const productTokens = [
    product.id,
    product.name,
    product.manufacturerItemId,
    product.sku,
    product.upc,
    product.model,
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  const matchTokens = [match.productId, match.productName, match.model]
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  return matchTokens.some((token) =>
    productTokens.some(
      (productToken) =>
        productToken === token ||
        productToken.includes(token) ||
        token.includes(productToken)
    )
  );
}

export function ProductRecallWatch({
  products,
  canRead,
  canWrite,
  open,
  onOpenChange,
  onRefreshProducts,
  onShowRecallProducts,
  onShowDiscontinuedProducts,
}: ProductRecallWatchProps) {
  const [internetScanEnabled, setInternetScanEnabled] = useState(false);
  const [scanNewProductsEnabled, setScanNewProductsEnabled] = useState(false);
  const [
    discontinuedScanEnabled,
    setDiscontinuedScanEnabled,
  ] = useState(false);
  const [
    scanNewDiscontinuedProductsEnabled,
    setScanNewDiscontinuedProductsEnabled,
  ] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [recallMatches, setRecallMatches] = useState<RecallMatch[]>([]);
  const [equipmentRecalls, setEquipmentRecalls] = useState<EquipmentRecall[]>(
    []
  );
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [imageEnrichmentLoading, setImageEnrichmentLoading] = useState(false);

  useEffect(() => {
    if (!canRead) return;

    const unsubscribe = onSnapshot(
      doc(db, "settings", "app"),
      (snapshot) => {
        const inventory =
          snapshot.data()?.inventory &&
          typeof snapshot.data()?.inventory === "object"
            ? (snapshot.data()?.inventory as Record<string, unknown>)
            : {};

        setInternetScanEnabled(
          typeof inventory.jarvisRecallInternetScanEnabled === "boolean"
            ? inventory.jarvisRecallInternetScanEnabled
            : false
        );
        setScanNewProductsEnabled(
          typeof inventory.jarvisRecallScanNewProductsEnabled === "boolean"
            ? inventory.jarvisRecallScanNewProductsEnabled
            : false
        );
        setDiscontinuedScanEnabled(
          typeof inventory.jarvisDiscontinuedInternetScanEnabled === "boolean"
            ? inventory.jarvisDiscontinuedInternetScanEnabled
            : false
        );
        setScanNewDiscontinuedProductsEnabled(
          typeof inventory.jarvisDiscontinuedScanNewProductsEnabled === "boolean"
            ? inventory.jarvisDiscontinuedScanNewProductsEnabled
            : false
        );
      },
      (error) => {
        console.error("PRODUCT RECALL SETTINGS SNAPSHOT ERROR:", error);
      }
    );

    return unsubscribe;
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return;

    setLoadingFindings(true);

    const recallMatchesQuery = query(collection(db, "recallMatches"), limit(75));
    const equipmentRecallsQuery = query(
      collection(db, "equipmentRecalls"),
      where("active", "==", true),
      limit(75)
    );

    let matchesLoaded = false;
    let recallsLoaded = false;

    function finishLoad() {
      if (matchesLoaded && recallsLoaded) {
        setLoadingFindings(false);
      }
    }

    const unsubscribeMatches = onSnapshot(
      recallMatchesQuery,
      (snapshot) => {
        setRecallMatches(
          snapshot.docs.map((matchDoc) =>
            normalizeRecallMatch(
              matchDoc.id,
              matchDoc.data() as Record<string, unknown>
            )
          )
        );
        matchesLoaded = true;
        finishLoad();
      },
      (error) => {
        console.error("PRODUCT RECALL MATCHES SNAPSHOT ERROR:", error);
        matchesLoaded = true;
        finishLoad();
      }
    );

    const unsubscribeRecalls = onSnapshot(
      equipmentRecallsQuery,
      (snapshot) => {
        setEquipmentRecalls(
          snapshot.docs.map((recallDoc) =>
            normalizeEquipmentRecall(
              recallDoc.id,
              recallDoc.data() as Record<string, unknown>
            )
          )
        );
        recallsLoaded = true;
        finishLoad();
      },
      (error) => {
        console.error("PRODUCT EQUIPMENT RECALLS SNAPSHOT ERROR:", error);
        recallsLoaded = true;
        finishLoad();
      }
    );

    return () => {
      unsubscribeMatches();
      unsubscribeRecalls();
    };
  }, [canRead]);

  const recallFlaggedProducts = useMemo(
    () => products.filter((product) => product.recallFlagged),
    [products]
  );

  const discontinuedProducts = useMemo(
    () => products.filter((product) => product.status === "discontinued"),
    [products]
  );

  const matchedFindings = useMemo(
    () =>
      recallFlaggedProducts.map((product) => ({
        product,
        matches: recallMatches.filter((match) =>
          matchRecallToProduct(match, product)
        ),
      })),
    [recallFlaggedProducts, recallMatches]
  );

  async function updateRecallSetting(
    key:
      | "jarvisRecallInternetScanEnabled"
      | "jarvisRecallScanNewProductsEnabled"
      | "jarvisDiscontinuedInternetScanEnabled"
      | "jarvisDiscontinuedScanNewProductsEnabled",
    value: boolean
  ) {
    if (!canWrite) {
      toast.error("You do not have permission to update product settings.");
      return;
    }

    setSavingSetting(true);

    try {
      const currentUser = auth.currentUser;

      await setDoc(
        doc(db, "settings", "app"),
        {
          inventory: {
            [key]: value,
          },
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.email ?? currentUser?.uid ?? "unknown",
        },
        { merge: true }
      );

      toast.success("Jarvis product watch setting updated.");
    } catch (error) {
      console.error("PRODUCT RECALL SETTING UPDATE ERROR:", error);
      toast.error("Failed to update Jarvis product watch setting.");
    } finally {
      setSavingSetting(false);
    }
  }

  async function handleEnrichProductImages() {
    if (!canWrite) {
      toast.error("You do not have permission to enrich product images.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("You must be signed in to run Jarvis image enrichment.");
      return;
    }

    const targets = products
      .filter((product) => !product.imageUrl || !product.thumbnailUrl)
      .slice(0, 25);

    if (targets.length === 0) {
      toast.success("Loaded products already have images.");
      return;
    }

    setImageEnrichmentLoading(true);

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/jarvis/product-enrichment", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "enrichProductImages",
          productIds: targets.map((product) => product.id),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        updated?: Array<{ productId: string }>;
      };

      if (!response.ok) {
        throw new Error(result.error || "Jarvis image enrichment failed.");
      }

      toast.success(
        `Jarvis added images to ${(result.updated ?? []).length.toLocaleString()} product record(s).`
      );
      onRefreshProducts?.();
    } catch (error) {
      console.error("JARVIS PRODUCT IMAGE ENRICHMENT ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Jarvis image enrichment failed.");
    } finally {
      setImageEnrichmentLoading(false);
    }
  }

  return (
    <section className={`${glass.panel} relative overflow-visible p-5 sm:p-6`}>
      <div aria-hidden="true" className={colors.grid} />

      <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className={`${glass.card} p-4 sm:p-5`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className={glass.iconBox}>
              <RadioTower className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className={typography.sectionTitle}>Jarvis Product Watch</h2>
              <p className={`mt-2 ${typography.bodyMuted}`}>
                Recall and discontinued-product monitoring is controlled here
                and saved through the shared settings record.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <RecallSwitch
              title="Internet Recall Scan"
              description="Allow Jarvis recall jobs to check external recall sources for catalog products."
              checked={internetScanEnabled}
              disabled={savingSetting || !canWrite}
              onChange={(checked) =>
                void updateRecallSetting(
                  "jarvisRecallInternetScanEnabled",
                  checked
                )
              }
            />

            <RecallSwitch
              title="Scan New Products Automatically"
              description="Apply recall checking to products added after this setting is enabled."
              checked={scanNewProductsEnabled}
              disabled={savingSetting || !canWrite}
              onChange={(checked) =>
                void updateRecallSetting(
                  "jarvisRecallScanNewProductsEnabled",
                  checked
                )
              }
            />

            <RecallSwitch
              title="Discontinued Product Search"
              description="Allow Jarvis to check external sources and catalog signals for discontinued product status."
              checked={discontinuedScanEnabled}
              disabled={savingSetting || !canWrite}
              onChange={(checked) =>
                void updateRecallSetting(
                  "jarvisDiscontinuedInternetScanEnabled",
                  checked
                )
              }
            />

            <RecallSwitch
              title="Check New Products For Discontinuation"
              description="Apply discontinued-product checking to products added after this setting is enabled."
              checked={scanNewDiscontinuedProductsEnabled}
              disabled={savingSetting || !canWrite}
              onChange={(checked) =>
                void updateRecallSetting(
                  "jarvisDiscontinuedScanNewProductsEnabled",
                  checked
                )
              }
            />
          </div>
        </div>

        <div className={`${glass.card} p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-200" />
                <h2 className={typography.sectionTitle}>Recall Findings</h2>
              </div>

              <p className={`mt-2 ${typography.bodyMuted}`}>
                {recallFlaggedProducts.length.toLocaleString()} product records
                are recall flagged. {recallMatches.length.toLocaleString()}{" "}
                Jarvis match records and{" "}
                {equipmentRecalls.length.toLocaleString()} active recall records
                are loaded. {discontinuedProducts.length.toLocaleString()}{" "}
                discontinued products are loaded.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttons.secondary}
                disabled={imageEnrichmentLoading || !canWrite}
                onClick={() => {
                  void handleEnrichProductImages();
                }}
              >
                {imageEnrichmentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Find Stock Images
              </button>

              <button
                type="button"
                className={buttons.secondary}
                onClick={onShowDiscontinuedProducts}
              >
                Discontinued Products
              </button>

              <button
                type="button"
                className={buttons.secondary}
                onClick={onShowRecallProducts}
              >
                Recall Products
              </button>

              <button
                type="button"
                className={buttons.warning}
                onClick={() => onOpenChange(!open)}
              >
                {open ? "Hide Findings" : "Open Findings"}
              </button>
            </div>
          </div>

          {open ? (
            <div className="mt-5 space-y-4">
              {loadingFindings ? (
                <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Loading Jarvis recall findings...
                </div>
              ) : null}

              {!loadingFindings && recallFlaggedProducts.length === 0 ? (
                <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                  No recall-flagged products are currently loaded.
                </div>
              ) : null}

              {matchedFindings.map(({ product, matches }) => (
                <div key={product.id} className={`${glass.inset} p-4`}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className={typography.cardTitle}>{product.name}</h3>
                      <p className={`mt-1 ${typography.smallMuted}`}>
                        {[
                          product.manufacturer,
                          product.model,
                          product.sku ? `SKU ${product.sku}` : "",
                          product.upc ? `UPC ${product.upc}` : "",
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </div>

                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      Recall flagged
                    </span>
                  </div>

                  {matches.length > 0 ? (
                    <div className="mt-4 grid gap-3">
                      {matches.map((match) => (
                        <div
                          key={match.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-3"
                        >
                          <p className="font-semibold text-white">
                            {match.recallTitle || "Jarvis recall match"}
                          </p>
                          <p className={`mt-1 ${typography.smallMuted}`}>
                            {[
                              match.manufacturer,
                              match.model,
                              match.severity ? `Severity ${match.severity}` : "",
                              match.status,
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                          <p className={`mt-3 ${typography.bodyMuted}`}>
                            {match.actionRequired ||
                              "No action instructions have been stored for this recall match yet."}
                          </p>
                          {match.sourceUrl ? (
                            <a
                              href={match.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100 hover:text-white"
                            >
                              Source
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`mt-4 ${glass.insetPadded}`}>
                      <div className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                        <p className={typography.bodyMuted}>
                          This product is flagged, but no specific Jarvis recall
                          match is stored yet. Review active recall records and
                          attach the matching recall before product handling.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {equipmentRecalls.length > 0 ? (
                <div className={`${glass.inset} p-4`}>
                  <h3 className={typography.cardTitle}>Active Recall Library</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {equipmentRecalls.slice(0, 6).map((recall) => (
                      <div
                        key={recall.id}
                        className="rounded-2xl border border-white/10 bg-black/20 p-3"
                      >
                        <p className="font-semibold text-white">
                          {recall.recallTitle || "Active recall"}
                        </p>
                        <p className={`mt-1 ${typography.smallMuted}`}>
                          {[recall.manufacturer, recall.model, recall.severity]
                            .filter(Boolean)
                            .join(" | ")}
                        </p>
                        <p className={`mt-2 ${typography.bodyMuted}`}>
                          {recall.actionRequired ||
                            "No action instructions stored."}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RecallSwitch({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div>
        <p className={typography.cardTitle}>{title}</p>
        <p className={`mt-1 text-sm leading-6 ${typography.bodyMuted}`}>
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative mt-1 h-6 w-11 shrink-0 rounded-full border transition",
          checked
            ? "border-cyan-300/40 bg-cyan-300/70"
            : "border-white/10 bg-slate-800",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "left-5" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
