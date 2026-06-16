"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  PackageCheck,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { badges, buttons, colors, glass, spacing, tables, typography } from "@/theme";

import { normalizeRentalRecord } from "../../rentals/utils/normalize";
import type { RentalRecord } from "../../rentals/rentals-types";
import { formatCurrency, formatDate } from "../../rentals/utils/formatters";
import { normalizeInventoryItem } from "../lib/inventoryNormalize";
import type { InventoryItem } from "../lib/inventoryTypes";

export default function InventoryAssetChartPage() {
  const params = useParams<{ assetId: string }>();
  const router = useRouter();
  const assetId = decodeURIComponent(params.assetId);

  const [asset, setAsset] = useState<InventoryItem | null>(null);
  const [rentals, setRentals] = useState<RentalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    setMessage("");

    const unsubscribe = onSnapshot(
      doc(db, "inventory", assetId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setAsset(null);
          setLoading(false);
          return;
        }

        setAsset(
          normalizeInventoryItem(
            snapshot.id,
            snapshot.data() as Record<string, unknown>
          )
        );
        setLoading(false);
      },
      (error) => {
        console.error("LOAD INVENTORY ASSET ERROR:", error);
        setAsset(null);
        setMessage("Could not load inventory asset. Check Firestore permissions.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [assetId]);

  useEffect(() => {
    if (!asset) {
      setRentals([]);
      return;
    }

    let active = true;
    const currentAsset = asset;

    async function loadRentalRows() {
      const rentalMap = new Map<string, RentalRecord>();
      const serial = currentAsset.serial.trim();
      const assetTag = (currentAsset.assetTag || currentAsset.assetNumber || "").trim();

      const queries = [];

      if (serial) {
        queries.push(
          query(collection(db, "rentals"), where("serialNumber", "==", serial), limit(100))
        );
      }

      if (assetTag && assetTag !== serial) {
        queries.push(
          query(collection(db, "rentals"), where("assetTag", "==", assetTag), limit(100))
        );
      }

      if (currentAsset.salesOrderDetailId) {
        queries.push(
          query(
            collection(db, "rentals"),
            where("salesOrderDetailId", "==", currentAsset.salesOrderDetailId),
            limit(100)
          )
        );
      }

      const snapshots = await Promise.all(queries.map((rentalQuery) => getDocs(rentalQuery)));

      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((rentalDoc) => {
          rentalMap.set(
            rentalDoc.id,
            normalizeRentalRecord(
              rentalDoc.id,
              rentalDoc.data() as Record<string, unknown>
            )
          );
        });
      });

      if (active) {
        setRentals(
          Array.from(rentalMap.values()).sort((a, b) =>
            a.patientName.localeCompare(b.patientName)
          )
        );
      }
    }

    void loadRentalRows().catch((error) => {
      console.error("LOAD ASSET RENTAL HISTORY ERROR:", error);
      if (active) setRentals([]);
    });

    return () => {
      active = false;
    };
  }, [asset]);

  const currentPatient = useMemo(() => {
    if (!asset) return null;

    return {
      key: asset.patientKey || asset.patientId || "",
      name: asset.patientName || "",
      id: asset.patientId || "",
      dob: asset.patientDob || "",
      phone: asset.patientPhone || "",
      payor: asset.insuranceName || asset.payor || "",
      plan: asset.planType || "",
    };
  }, [asset]);

  if (loading) {
    return (
      <PageShell>
        <GlassPanel>
          <div className={[spacing.inlineMd, typography.bodyMuted].join(" ")}>
            <PackageCheck className="h-5 w-5 animate-pulse" />
            Loading asset chart...
          </div>
        </GlassPanel>
      </PageShell>
    );
  }

  if (!asset) {
    return (
      <PageShell>
        <GlassPanel>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <p className={typography.bodyMuted}>
            {message || "Inventory asset not found."}
          </p>
        </GlassPanel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AssetHeader asset={asset} />

      <section className="grid min-w-0 gap-4 lg:grid-cols-3">
        <ChartSection title="Asset Identity" icon={<PackageCheck className="h-5 w-5" />}>
          <Info label="Serial" value={asset.serial} />
          <Info label="Asset Tag" value={asset.assetTag || asset.assetNumber} />
          <Info label="SKU / Item ID" value={asset.sku || asset.productId} />
          <Info label="HCPCS" value={asset.hcpc} />
          <Info label="Category" value={asset.category} />
          <Info label="Location" value={asset.locationName} />
        </ChartSection>

        <ChartSection title="Assigned Patient" icon={<UserRound className="h-5 w-5" />}>
          <Info label="Patient" value={currentPatient?.name} />
          <Info label="Patient ID" value={currentPatient?.id} />
          <Info label="DOB" value={currentPatient?.dob} />
          <Info label="Phone" value={currentPatient?.phone} />
          <Info label="Payor" value={currentPatient?.payor} />
          <Info label="Plan" value={currentPatient?.plan} />
          {currentPatient?.key ? (
            <Link
              href={`/reports/patients/${encodeURIComponent(currentPatient.key)}`}
              className={buttons.compactPrimary}
            >
              Open patient chart
            </Link>
          ) : null}
        </ChartSection>

        <ChartSection title="Rental Order" icon={<CalendarClock className="h-5 w-5" />}>
          <Info label="Sales Order" value={asset.salesOrderId} />
          <Info label="Detail ID" value={asset.salesOrderDetailId} />
          <Info label="Original DOS" value={asset.originalDos} />
          <Info label="Next DOS" value={asset.nextDos} />
          <Info label="Next Billing" value={asset.nextBillingDate} />
          <Info label="PAR" value={asset.parNumber} />
          <Info label="PAR Expiration" value={asset.parExpiration} />
        </ChartSection>

        <ChartSection title="Clinical / Provider" icon={<Stethoscope className="h-5 w-5" />}>
          <Info label="Ordering Doctor" value={asset.orderingDoctor} />
          <Info label="Primary Doctor" value={asset.primaryDoctor} />
          <Info label="Source" value={asset.sourceReport} />
        </ChartSection>

        <ChartSection title="Stock State" icon={<ShieldCheck className="h-5 w-5" />}>
          <Info label="Status" value={asset.status.replaceAll("_", " ")} />
          <Info label="Lifecycle" value={asset.lifecycleStatus.replaceAll("_", " ")} />
          <Info label="On Hand" value={String(asset.quantityOnHand)} />
          <Info label="On Rent" value={String(asset.onRent)} />
          <Info label="Available" value={String(asset.available)} />
          <Info label="Next Service" value={asset.nextServiceDate} />
        </ChartSection>
      </section>

      <RentalPatientSection rentals={rentals} />
    </PageShell>
  );
}

function AssetHeader({ asset }: { asset: InventoryItem }) {
  return (
    <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.12] via-white/[0.055] to-black/40 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <Link
        href="/inventory"
        className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
            <FileText className="h-3.5 w-3.5" />
            Inventory asset chart
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-3xl font-bold leading-[1.15] tracking-tight text-white">
              {asset.name || "Unnamed asset"}
            </h1>

            <Badge label={asset.status.replaceAll("_", " ")} />
            {asset.patientName ? <Badge label="Patient assigned" /> : null}
          </div>

          <p className="mt-2 text-sm text-zinc-400">
            Serial: {asset.serial || "-"} | Asset:{" "}
            {asset.assetTag || asset.assetNumber || "-"}
          </p>
        </div>
      </div>
    </header>
  );
}

function RentalPatientSection({ rentals }: { rentals: RentalRecord[] }) {
  return (
    <section className={glass.cardPadded}>
      <div className={`mb-4 ${spacing.inline} ${typography.bodyStrong}`}>
        <div className={glass.iconBoxSm}>
          <UserRound className="h-5 w-5" />
        </div>
        <h2 className={typography.cardTitle}>Patients For This Equipment</h2>
      </div>

      {rentals.length === 0 ? (
        <p className={tables.empty}>
          No rental patient rows found for this serial or asset number.
        </p>
      ) : (
        <div className={tables.wrapper}>
          <div className={tables.scroll}>
            <table className={`${tables.table} min-w-[1050px]`}>
              <thead className={tables.head}>
                <tr>
                  <th className={tables.headCell}>Patient</th>
                  <th className={tables.headCell}>Payor</th>
                  <th className={tables.headCell}>Order</th>
                  <th className={tables.headCell}>Dates</th>
                  <th className={tables.headCell}>PAR</th>
                  <th className={tables.headCell}>Allowable</th>
                  <th className={tables.headCell}>Chart</th>
                </tr>
              </thead>

              <tbody className={tables.body}>
                {rentals.map((rental) => (
                  <tr key={rental.id} className={tables.row}>
                    <td className={tables.cellStrong}>
                      <div>{rental.patientName || "-"}</div>
                      <div className={typography.smallMuted}>
                        ID {rental.patientId || "-"} | DOB{" "}
                        {formatDate(rental.patientDob)}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>{rental.insuranceName || rental.payor || "-"}</div>
                      <div className={typography.smallMuted}>
                        {rental.planType || "-"}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>{rental.salesOrderId || "-"}</div>
                      <div className={typography.smallMuted}>
                        Detail {rental.salesOrderDetailId || "-"}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>Out {formatDate(rental.checkedOutDate)}</div>
                      <div>Next {formatDate(rental.nextBillingDate || rental.expectedReturnDate)}</div>
                    </td>
                    <td className={tables.cell}>
                      <div>{rental.parNumber || "-"}</div>
                      <div className={typography.smallMuted}>
                        Exp {formatDate(rental.parExpiration)}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      {formatCurrency(rental.monthlyRate)}
                    </td>
                    <td className={tables.cell}>
                      {rental.patientId ? (
                        <Link
                          href={`/reports/patients/${encodeURIComponent(rental.patientId)}`}
                          className={buttons.compactSecondary}
                        >
                          Open
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={[colors.app, colors.textPrimary, spacing.page].join(" ")}>
      <div className={[spacing.content, spacing.stack].join(" ")}>
        {children}
      </div>
    </main>
  );
}

function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <section className={[glass.cardPadded, spacing.cardLg].join(" ")}>
      {children}
    </section>
  );
}

function ChartSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${glass.cardPadded} min-w-0`}>
      <div className={`mb-4 ${spacing.inline} ${typography.bodyStrong}`}>
        <div className={glass.iconBoxSm}>{icon}</div>
        <h3 className={typography.cardTitle}>{title}</h3>
      </div>

      <div className="grid min-w-0 gap-3">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className={`${glass.insetPadded} p-3`}>
      <p className={typography.smallMuted}>{label}</p>
      <p className={`mt-1 break-words ${typography.bodyStrong}`}>
        {value || "-"}
      </p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className={["rounded-full px-3 py-1 text-xs capitalize", badges.info].join(" ")}>
      {label}
    </span>
  );
}
