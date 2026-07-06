"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { tables } from "@/theme";

import type { CurrentEquipmentItem } from "../patient-detail-types";
import { formatDate } from "../patient-detail-utils";

type InventoryMatch = {
  id: string;
  serial: string;
};

function cleanSerial(value: string | undefined): string {
  return String(value ?? "").trim();
}

export function EquipmentTable({
  items,
}: {
  items: CurrentEquipmentItem[];
}) {
  const [matchesBySerial, setMatchesBySerial] = useState<Record<string, InventoryMatch>>({});

  const serials = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => cleanSerial(item.serialNumber))
          .filter(Boolean)
      )
    );
  }, [items]);

  useEffect(() => {
    let active = true;

    async function loadInventoryMatches() {
      if (!serials.length) {
        setMatchesBySerial({});
        return;
      }

      const matchMap: Record<string, InventoryMatch> = {};

      await Promise.all(
        serials.map(async (serial) => {
          const snapshot = await getDocs(
            query(
              collection(db, "inventory"),
              where("serial", "==", serial),
              limit(1)
            )
          );

          const match = snapshot.docs[0];

          if (match) {
            matchMap[serial] = {
              id: match.id,
              serial,
            };
          }
        })
      );

      if (active) {
        setMatchesBySerial(matchMap);
      }
    }

    void loadInventoryMatches().catch((error) => {
      console.error("LOAD PATIENT EQUIPMENT INVENTORY MATCHES ERROR:", error);

      if (active) {
        setMatchesBySerial({});
      }
    });

    return () => {
      active = false;
    };
  }, [serials]);

  if (!items.length) {
    return (
      <p className={tables.empty}>
        No current equipment indexed for this patient.
      </p>
    );
  }

  return (
    <div className={tables.wrapper}>
      <div className={tables.scroll}>
        <table className={`${tables.table} min-w-[1100px]`}>
          <thead className={tables.head}>
            <tr>
              <th className={tables.headCell}>Item</th>
              <th className={tables.headCell}>HCPCS</th>
              <th className={tables.headCell}>Type</th>
              <th className={tables.headCell}>Qty</th>
              <th className={tables.headCell}>Status</th>
              <th className={tables.headCell}>Serial</th>
              <th className={tables.headCell}>Lot</th>
              <th className={tables.headCell}>Start</th>
              <th className={tables.headCell}>Maintenance</th>
              <th className={tables.headCell}>Replacement Due</th>
              <th className={tables.headCell}>Inventory</th>
            </tr>
          </thead>

          <tbody className={tables.body}>
            {items.slice(0, 25).map((item, index) => {
              const serial = cleanSerial(item.serialNumber);
              const match = serial ? matchesBySerial[serial] : undefined;

              return (
                <tr
                  key={`${item.itemName}-${item.serialNumber}-${index}`}
                  className={tables.row}
                >
                  <td className={tables.cellStrong}>
                    {item.itemName || "—"}
                  </td>

                  <td className={tables.cell}>
                    {item.hcpc || item.itemId || "—"}
                  </td>

                  <td className={tables.cell}>
                    {item.saleType || "—"}
                  </td>

                  <td className={tables.cell}>
                    {item.qty ?? "—"}
                  </td>

                  <td className={tables.cell}>
                    {item.status || "—"}
                  </td>

                  <td className={tables.cell}>
                    {serial || "—"}
                  </td>

                  <td className={tables.cell}>
                    {item.lotNumber || "—"}
                  </td>

                  <td className={tables.cell}>
                    {formatDate(item.startDate)}
                  </td>

                  <td className={tables.cell}>
                    {item.maintenanceStatus || "—"}
                  </td>

                  <td className={tables.cell}>
                    {formatDate(item.replacementDueDate)}
                  </td>

                  <td className={tables.cell}>
                    {match ? (
                      <Link
                        href={`/inventory/${encodeURIComponent(match.id)}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        View Asset
                      </Link>
                    ) : (
                      "No match"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}