"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";

export type TechLocationCheckIn = {
  id: string;
  techName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  ticketId: string;
  deliveryTicketNumber: string;
  patientName: string;
  recordedByEmail: string;
  recordedAt: Timestamp | null;
};

function readNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLocation(
  id: string,
  data: Record<string, unknown>
): TechLocationCheckIn {
  const recordedAt =
    data.recordedAt &&
    typeof data.recordedAt === "object" &&
    "toDate" in data.recordedAt
      ? (data.recordedAt as Timestamp)
      : null;

  return {
    id,
    techName: String(data.techName ?? ""),
    latitude: readNumber(data.latitude),
    longitude: readNumber(data.longitude),
    accuracy: readNumber(data.accuracy),
    ticketId: String(data.ticketId ?? ""),
    deliveryTicketNumber: String(data.deliveryTicketNumber ?? ""),
    patientName: String(data.patientName ?? ""),
    recordedByEmail: String(data.recordedByEmail ?? ""),
    recordedAt,
  };
}

export function useTechLocations(enabled = true) {
  const [locations, setLocations] = useState<TechLocationCheckIn[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLocations([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const locationsQuery = query(
      collection(db, "deliveryTechLocations"),
      orderBy("recordedAt", "desc"),
      limit(100)
    );

    return onSnapshot(
      locationsQuery,
      (snapshot) => {
        setLocations(
          snapshot.docs.map((docSnap) =>
            normalizeLocation(docSnap.id, docSnap.data())
          )
        );
        setLoading(false);
      },
      (error) => {
        console.error("TECH LOCATIONS SNAPSHOT ERROR:", error);
        toast.error("Unable to load tech locations.");
        setLocations([]);
        setLoading(false);
      }
    );
  }, [enabled]);

  const latestByTech = useMemo(() => {
    const latest = new Map<string, TechLocationCheckIn>();

    for (const location of locations) {
      if (!location.techName) continue;
      if (!latest.has(location.techName)) {
        latest.set(location.techName, location);
      }
    }

    return Array.from(latest.values());
  }, [locations]);

  return {
    latestByTech,
    loading,
  };
}
